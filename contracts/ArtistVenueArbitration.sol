// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IXAOToken.sol";
import "./interfaces/IParentEventContract.sol";

/// @title Artist Venue Arbitration Contract
/// @notice Handles disputes between artists and venues with AI-driven resolution
contract ArtistVenueArbitration is Ownable, ReentrancyGuard, Pausable {
    // Custom errors for gas optimization
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error EvidenceAlreadySubmitted();
    error EvidencePeriodExpired();
    error DecisionAlreadyIssued();
    error ExceedsContractAmount();
    error NoDecisionIssued();
    error AlreadyResolved();
    error ResolutionPeriodNotEnded();
    error TransferFailed();

    struct DisputeParties {
        address artist;
        address venue;
        address eventContract;
        address initiator;
    }

    struct DisputeFinancials {
        uint256 contractAmount;
        uint256 depositAmount;
        uint256 approvedAmount;
        uint256 penaltyAmount;
    }

    // Optimized struct packing for state variables
    struct DisputeState {
        uint40 filingTime;         // Reduced from uint256, still good until year 2078
        uint8 status;             // Changed from enum to uint8
        uint8 resolutionType;     // Changed from enum to uint8
        bool evidenceComplete;
        bool aiDecisionIssued;
        bool isAppealed;
        bool isResolved;
        bool refundsRequired;
        bool refundsProcessed;
    }

    struct DisputeEvidence {
        bytes32 evidenceIPFSHash;
        bytes32 aiDecisionIPFSHash;
        string resolutionDetails;
        uint256[] ticketIds;
    }

    struct Dispute {
        DisputeParties parties;
        DisputeFinancials financials;
        DisputeState state;
        DisputeEvidence evidence;
    }

    // Enums converted to uint8 constants for gas optimization
    uint8 constant STATUS_FILED = 0;
    uint8 constant STATUS_EVIDENCE_PHASE = 1;
    uint8 constant STATUS_AI_REVIEW = 2;
    uint8 constant STATUS_APPEALED = 3;
    uint8 constant STATUS_RESOLVED = 4;
    uint8 constant STATUS_EXECUTED = 5;

    uint8 constant RESOLUTION_FULL_ARTIST_PAYMENT = 0;
    uint8 constant RESOLUTION_PARTIAL_PAYMENT = 1;
    uint8 constant RESOLUTION_FULL_VENUE_REFUND = 2;
    uint8 constant RESOLUTION_PENALTY_APPLIED = 3;
    uint8 constant RESOLUTION_TICKET_REFUNDS = 4;

    uint256 private immutable EVIDENCE_PERIOD;
    uint256 private immutable APPEAL_PERIOD;

    IXAOToken public immutable xaoToken;
    uint256 private disputeCount;

    mapping(uint256 => Dispute) private disputes;
    mapping(address => uint256[]) private artistDisputes;
    mapping(address => uint256[]) private venueDisputes;

    event DisputeFiled(
        uint256 indexed disputeId,
        address indexed artist,
        address indexed venue,
        uint256 contractAmount
    );

    event EvidenceSubmitted(
        uint256 indexed disputeId,
        bytes32 evidenceIPFSHash
    );

    event AIDecisionIssued(
        uint256 indexed disputeId,
        bytes32 decisionIPFSHash,
        uint256 approvedAmount,
        bool refundsRequired,
        uint8 resolutionType
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 artistPayment,
        uint256 venueRefund,
        uint8 resolutionType
    );

    event PaymentProcessed(
        uint256 indexed disputeId,
        address recipient,
        uint256 amount,
        string paymentType
    );

    constructor(address _xaoToken) {
        if (_xaoToken == address(0)) revert InvalidAddress();
        xaoToken = IXAOToken(_xaoToken);
        EVIDENCE_PERIOD = 5 days;
        APPEAL_PERIOD = 2 days;
    }

    function fileDispute(
        address artist,
        address venue,
        address eventContract,
        uint256 contractAmount,
        uint256 depositAmount
    ) external whenNotPaused {
        if (msg.sender != artist && msg.sender != venue) revert Unauthorized();
        if (contractAmount == 0) revert InvalidAmount();
        if (artist == address(0) || venue == address(0)) revert InvalidAddress();
        if (eventContract == address(0)) revert InvalidAddress();

        uint256 disputeId = disputeCount;
        unchecked { disputeCount++; }

        disputes[disputeId] = Dispute({
            parties: DisputeParties({
                artist: artist,
                venue: venue,
                eventContract: eventContract,
                initiator: msg.sender
            }),
            financials: DisputeFinancials({
                contractAmount: contractAmount,
                depositAmount: depositAmount,
                approvedAmount: 0,
                penaltyAmount: 0
            }),
            state: DisputeState({
                filingTime: uint40(block.timestamp),
                status: STATUS_FILED,
                resolutionType: RESOLUTION_FULL_ARTIST_PAYMENT,
                evidenceComplete: false,
                aiDecisionIssued: false,
                isAppealed: false,
                isResolved: false,
                refundsRequired: false,
                refundsProcessed: false
            }),
            evidence: DisputeEvidence({
                evidenceIPFSHash: 0,
                aiDecisionIPFSHash: 0,
                resolutionDetails: "",
                ticketIds: new uint256[](0)
            })
        });

        artistDisputes[artist].push(disputeId);
        venueDisputes[venue].push(disputeId);

        emit DisputeFiled(disputeId, artist, venue, contractAmount);
    }

    function submitEvidence(
        uint256 disputeId,
        bytes32 evidenceHash
    ) external whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        if (msg.sender != dispute.parties.artist && msg.sender != dispute.parties.venue)
            revert Unauthorized();
        if (dispute.state.evidenceComplete)
            revert EvidenceAlreadySubmitted();
        if (block.timestamp > dispute.state.filingTime + EVIDENCE_PERIOD)
            revert EvidencePeriodExpired();

        dispute.evidence.evidenceIPFSHash = evidenceHash;
        dispute.state.evidenceComplete = true;
        dispute.state.status = STATUS_AI_REVIEW;

        emit EvidenceSubmitted(disputeId, evidenceHash);
    }

    function submitAIDecision(
        uint256 disputeId,
        bytes32 decisionHash,
        uint256 approvedAmount,
        bool refundsRequired,
        uint8 resolutionType,
        string calldata resolutionDetails
    ) external onlyOwner whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        if (!dispute.state.evidenceComplete)
            revert EvidenceAlreadySubmitted();
        if (dispute.state.aiDecisionIssued)
            revert DecisionAlreadyIssued();
        if (approvedAmount > dispute.financials.contractAmount)
            revert ExceedsContractAmount();

        dispute.evidence.aiDecisionIPFSHash = decisionHash;
        dispute.financials.approvedAmount = approvedAmount;
        dispute.state.refundsRequired = refundsRequired;
        dispute.state.aiDecisionIssued = true;
        dispute.state.status = STATUS_RESOLVED;
        dispute.state.resolutionType = resolutionType;
        dispute.evidence.resolutionDetails = resolutionDetails;

        emit AIDecisionIssued(
            disputeId,
            decisionHash,
            approvedAmount,
            refundsRequired,
            resolutionType
        );
    }

    function executeResolution(
        uint256 disputeId
    ) external nonReentrant whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        if (!dispute.state.aiDecisionIssued)
            revert NoDecisionIssued();
        if (dispute.state.isResolved)
            revert AlreadyResolved();
        if (block.timestamp <= dispute.state.filingTime + EVIDENCE_PERIOD + APPEAL_PERIOD &&
            !(dispute.state.aiDecisionIssued && !dispute.state.isAppealed))
            revert ResolutionPeriodNotEnded();

        _processPayments(disputeId);

        dispute.state.isResolved = true;
        dispute.state.status = STATUS_EXECUTED;

        emit DisputeResolved(
            disputeId,
            dispute.financials.approvedAmount,
            dispute.financials.contractAmount - dispute.financials.approvedAmount,
            dispute.state.resolutionType
        );
    }

    function _processPayments(uint256 disputeId) private {
        Dispute storage dispute = disputes[disputeId];
        bool success;

        // Batch all payments into a single function
        (uint256 artistAmount, uint256 venueAmount) = _calculatePayments(dispute);

        if (artistAmount > 0) {
            success = xaoToken.transfer(dispute.parties.artist, artistAmount);
            if (!success) revert TransferFailed();
            emit PaymentProcessed(disputeId, dispute.parties.artist, artistAmount, 
                dispute.state.resolutionType == RESOLUTION_FULL_ARTIST_PAYMENT ? "Full Payment" : "Partial Payment");
        }

        if (venueAmount > 0) {
            success = xaoToken.transfer(dispute.parties.venue, venueAmount);
            if (!success) revert TransferFailed();
            emit PaymentProcessed(disputeId, dispute.parties.venue, venueAmount,
                dispute.state.resolutionType == RESOLUTION_FULL_VENUE_REFUND ? "Full Refund" : "Partial Refund");
        }
    }

    function _calculatePayments(Dispute storage dispute) private view returns (uint256 artistAmount, uint256 venueAmount) {
        if (dispute.state.resolutionType == RESOLUTION_FULL_ARTIST_PAYMENT) {
            return (dispute.financials.contractAmount, 0);
        } else if (dispute.state.resolutionType == RESOLUTION_FULL_VENUE_REFUND) {
            return (0, dispute.financials.contractAmount);
        } else if (dispute.state.resolutionType == RESOLUTION_PARTIAL_PAYMENT) {
            return (
                dispute.financials.approvedAmount,
                dispute.financials.contractAmount - dispute.financials.approvedAmount
            );
        }
        return (0, 0);
    }

    // Getters
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function getArtistDisputes(address artist) external view returns (uint256[] memory) {
        return artistDisputes[artist];
    }

    function getVenueDisputes(address venue) external view returns (uint256[] memory) {
        return venueDisputes[venue];
    }

    function getDisputeCount() external view returns (uint256) {
        return disputeCount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}