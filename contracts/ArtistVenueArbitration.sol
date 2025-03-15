// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./XAOToken.sol";
import "./interfaces/IParentEventContract.sol";

/// @title Artist Venue Arbitration Contract
/// @notice Handles disputes between artists and venues with AI-driven resolution
contract ArtistVenueArbitration is Ownable, ReentrancyGuard, Pausable {
    struct Dispute {
        address artist;
        address venue;
        address eventContract;
        uint256 contractAmount;
        uint256 depositAmount;
        uint256 filingTime;
        address initiator;
        bool evidenceComplete;
        bool aiDecisionIssued;
        bool isAppealed;
        bytes32 evidenceIPFSHash;
        bytes32 aiDecisionIPFSHash;
        uint256 approvedAmount;
        bool refundsRequired;
        uint256 penaltyAmount;
        bool isResolved;
        DisputeStatus status;
        // Ticket refund tracking
        uint256[] ticketIds;
        bool refundsProcessed;
        // Resolution details
        ResolutionType resolutionType;
        string resolutionDetails;
    }

    enum DisputeStatus {
        Filed,          // Initial state
        EvidencePhase,  // Collecting evidence
        AIReview,       // Under AI review
        Appealed,       // Decision appealed
        Resolved,       // Final resolution reached
        Executed        // Payments processed
    }

    enum ResolutionType {
        FullArtistPayment,    // Artist performed as agreed
        PartialPayment,       // Incomplete performance
        FullVenueRefund,      // Artist failed to perform
        PenaltyApplied,       // Contract violations occurred
        TicketRefunds         // Event significantly disrupted
    }

    // Time windows
    uint256 public constant EVIDENCE_PERIOD = 5 days;
    uint256 public constant APPEAL_PERIOD = 2 days;

    // State variables
    XAOToken public xaoToken;
    uint256 public disputeCount;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public artistDisputes;
    mapping(address => uint256[]) public venueDisputes;

    // Events
    event DisputeFiled(
        uint256 indexed disputeId,
        address indexed artist,
        address indexed venue,
        uint256 contractAmount,
        address initiator
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
        uint256 penaltyAmount,
        ResolutionType resolutionType
    );

    event DisputeAppealed(uint256 indexed disputeId);

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 artistPayment,
        uint256 venueRefund,
        uint256 penalties,
        bool refundsProcessed,
        ResolutionType resolutionType
    );

    event TicketRefundsInitiated(
        uint256 indexed disputeId,
        uint256[] ticketIds,
        uint256 totalAmount
    );

    event TicketRefundsCompleted(
        uint256 indexed disputeId,
        uint256 totalRefunded
    );

    constructor(address _xaoToken) {
        require(_xaoToken != address(0), "Invalid token address");
        xaoToken = XAOToken(_xaoToken);
    }

    /// @notice File a new dispute between artist and venue
    function fileDispute(
        address artist,
        address venue,
        address eventContract,
        uint256 contractAmount,
        uint256 depositAmount
    ) external whenNotPaused {
        require(msg.sender == artist || msg.sender == venue, "Unauthorized");
        require(contractAmount > 0, "Invalid amount");
        require(artist != address(0) && venue != address(0), "Invalid addresses");
        require(eventContract != address(0), "Invalid event contract");

        uint256 disputeId = disputeCount++;
        Dispute storage dispute = disputes[disputeId];

        dispute.artist = artist;
        dispute.venue = venue;
        dispute.eventContract = eventContract;
        dispute.contractAmount = contractAmount;
        dispute.depositAmount = depositAmount;
        dispute.filingTime = block.timestamp;
        dispute.initiator = msg.sender;
        dispute.status = DisputeStatus.Filed;

        artistDisputes[artist].push(disputeId);
        venueDisputes[venue].push(disputeId);

        emit DisputeFiled(disputeId, artist, venue, contractAmount, msg.sender);
    }

    /// @notice Register tickets for potential refunds
    function registerTicketsForRefund(
        uint256 disputeId,
        uint256[] calldata ticketIds
    ) external onlyOwner whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.refundsRequired, "Refunds not required");
        require(!dispute.refundsProcessed, "Refunds already processed");
        require(dispute.eventContract != address(0), "No event contract");

        dispute.ticketIds = ticketIds;

        emit TicketRefundsInitiated(
            disputeId,
            ticketIds,
            dispute.contractAmount
        );
    }

    /// @notice Process ticket refunds through the event contract
    function processTicketRefunds(
        uint256 disputeId
    ) external nonReentrant whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.refundsRequired, "Refunds not required");
        require(!dispute.refundsProcessed, "Already processed");
        require(dispute.isResolved, "Dispute not resolved");
        require(dispute.ticketIds.length > 0, "No tickets registered");

        IParentEventContract eventContract = IParentEventContract(dispute.eventContract);
        uint256 totalRefunded = eventContract.processTicketRefunds(dispute.ticketIds);

        dispute.refundsProcessed = true;

        emit TicketRefundsCompleted(disputeId, totalRefunded);
    }

    /// @notice Submit evidence for a dispute
    function submitEvidence(
        uint256 disputeId,
        bytes32 evidenceHash
    ) external whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        require(
            msg.sender == dispute.artist || msg.sender == dispute.venue,
            "Unauthorized"
        );
        require(!dispute.evidenceComplete, "Evidence already submitted");
        require(
            block.timestamp <= dispute.filingTime + EVIDENCE_PERIOD,
            "Evidence period expired"
        );

        dispute.evidenceIPFSHash = evidenceHash;
        dispute.evidenceComplete = true;
        dispute.status = DisputeStatus.AIReview;

        emit EvidenceSubmitted(disputeId, evidenceHash);
    }

    /// @notice Submit AI-generated decision for dispute resolution
    function submitAIDecision(
        uint256 disputeId,
        bytes32 decisionHash,
        uint256 approvedAmount,
        bool refundsRequired,
        uint256 penaltyAmount,
        ResolutionType resolutionType,
        string calldata resolutionDetails
    ) external onlyOwner whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.evidenceComplete, "Evidence not complete");
        require(!dispute.aiDecisionIssued, "Decision already issued");
        require(
            approvedAmount <= dispute.contractAmount,
            "Amount exceeds contract"
        );

        dispute.aiDecisionIPFSHash = decisionHash;
        dispute.approvedAmount = approvedAmount;
        dispute.refundsRequired = refundsRequired;
        dispute.penaltyAmount = penaltyAmount;
        dispute.aiDecisionIssued = true;
        dispute.status = DisputeStatus.Resolved;
        dispute.resolutionType = resolutionType;
        dispute.resolutionDetails = resolutionDetails;

        emit AIDecisionIssued(
            disputeId,
            decisionHash,
            approvedAmount,
            refundsRequired,
            penaltyAmount,
            resolutionType
        );
    }

    /// @notice Execute the final resolution for a dispute
    function executeResolution(
        uint256 disputeId
    ) external nonReentrant whenNotPaused {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.aiDecisionIssued, "No decision issued");
        require(!dispute.isResolved, "Already resolved");
        require(
            block.timestamp > dispute.filingTime + EVIDENCE_PERIOD + APPEAL_PERIOD ||
            (dispute.aiDecisionIssued && !dispute.isAppealed),
            "Resolution period not ended"
        );

        uint256 artistPayment = dispute.approvedAmount;
        uint256 venueRefund = dispute.contractAmount - dispute.approvedAmount;
        uint256 penalties = dispute.penaltyAmount;

        // Process payments based on resolution type
        if (dispute.resolutionType == ResolutionType.FullArtistPayment) {
            require(
                xaoToken.transfer(dispute.artist, dispute.contractAmount),
                "Artist payment failed"
            );
        } else if (dispute.resolutionType == ResolutionType.PartialPayment) {
            require(
                xaoToken.transfer(dispute.artist, artistPayment),
                "Artist payment failed"
            );
            require(
                xaoToken.transfer(dispute.venue, venueRefund),
                "Venue refund failed"
            );
        } else if (dispute.resolutionType == ResolutionType.FullVenueRefund) {
            require(
                xaoToken.transfer(dispute.venue, dispute.contractAmount),
                "Venue refund failed"
            );
        }

        // Apply penalties if any
        if (penalties > 0) {
            // Penalties are handled according to the contract terms
            // They could be sent to a DAO treasury or distributed
            // Implementation depends on the specific requirements
        }

        dispute.isResolved = true;
        dispute.status = DisputeStatus.Executed;

        emit DisputeResolved(
            disputeId,
            artistPayment,
            venueRefund,
            penalties,
            dispute.refundsProcessed,
            dispute.resolutionType
        );
    }

    /// @notice Get detailed information about a dispute
    function getDisputeDetails(uint256 disputeId)
        external
        view
        returns (
            address artist,
            address venue,
            address eventContract,
            uint256 contractAmount,
            uint256 depositAmount,
            uint256 filingTime,
            address initiator,
            bool evidenceComplete,
            bool aiDecisionIssued,
            bool isAppealed,
            bytes32 evidenceIPFSHash,
            bytes32 aiDecisionIPFSHash,
            uint256 approvedAmount,
            bool refundsRequired,
            uint256 penaltyAmount,
            bool isResolved,
            DisputeStatus status,
            uint256[] memory ticketIds,
            bool refundsProcessed,
            ResolutionType resolutionType,
            string memory resolutionDetails
        )
    {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.artist,
            dispute.venue,
            dispute.eventContract,
            dispute.contractAmount,
            dispute.depositAmount,
            dispute.filingTime,
            dispute.initiator,
            dispute.evidenceComplete,
            dispute.aiDecisionIssued,
            dispute.isAppealed,
            dispute.evidenceIPFSHash,
            dispute.aiDecisionIPFSHash,
            dispute.approvedAmount,
            dispute.refundsRequired,
            dispute.penaltyAmount,
            dispute.isResolved,
            dispute.status,
            dispute.ticketIds,
            dispute.refundsProcessed,
            dispute.resolutionType,
            dispute.resolutionDetails
        );
    }

    /// @notice Get all disputes for an artist
    function getArtistDisputes(address artist)
        external
        view
        returns (uint256[] memory)
    {
        return artistDisputes[artist];
    }

    /// @notice Get all disputes for a venue
    function getVenueDisputes(address venue)
        external
        view
        returns (uint256[] memory)
    {
        return venueDisputes[venue];
    }

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }
}