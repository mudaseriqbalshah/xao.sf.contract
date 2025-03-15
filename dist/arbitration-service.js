"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitrationService = void 0;
const ethers_1 = require("ethers");
const arbitration_cdp_agent_1 = require("./arbitration-cdp-agent");
class ArbitrationService {
    constructor(openaiApiKey, provider, signer) {
        this.agent = new arbitration_cdp_agent_1.CdpArbitrationAgent(openaiApiKey, provider);
        this.provider = provider;
        this.signer = signer;
        // Set up event handlers for agent updates
        this.agent.onUpdate(update => {
            console.log(`Agent Update: ${update.message}`);
            if (update.evidence) {
                console.log('Evidence:', update.evidence);
            }
            if (update.taskId) {
                console.log('Task ID:', update.taskId);
            }
        });
    }
    async handleDispute(disputeId, contractAddress) {
        // Get dispute details from smart contract
        const dispute = await this.getDisputeDetails(disputeId, contractAddress);
        // Process contract terms
        this.agent.analyzeContractTerms(dispute.contractTerms);
        // Process evidence
        for (const evidence of dispute.evidence) {
            await this.agent.processEvidence(evidence);
        }
        // Generate decision
        const result = await this.agent.generateDecision();
        // Submit decision to smart contract
        await this.submitDecision(disputeId, contractAddress, result);
        return {
            disputeId,
            decision: result.decision,
            reasoning: result.reasoning,
            confidence: result.confidenceScore
        };
    }
    async getDisputeDetails(disputeId, contractAddress) {
        const contract = new ethers_1.ethers.Contract(contractAddress, [
            "function getDisputeDetails(uint256 disputeId) view returns (address, address, address, string, string)"
        ], this.provider);
        const dispute = await contract.getDisputeDetails(disputeId);
        return {
            artist: dispute[0],
            venue: dispute[1],
            eventContract: dispute[2],
            contractTerms: this.parseContractTerms(dispute[3]),
            evidence: this.parseEvidence(dispute[4])
        };
    }
    async submitDecision(disputeId, contractAddress, result) {
        const contract = new ethers_1.ethers.Contract(contractAddress, [
            "function submitAIDecision(uint256 disputeId, bytes32 decisionHash, uint256 approvedAmount, bool refundsRequired, uint256 penaltyAmount, uint8 resolutionType, string memory resolutionDetails) external"
        ], this.signer);
        const resolutionType = this.getResolutionType(result.decision);
        const tx = await contract.submitAIDecision(disputeId, ethers_1.ethers.utils.id(result.reasoning), ethers_1.ethers.utils.parseEther(result.artistPaymentPercentage.toString()), result.requiresTicketRefunds, result.penaltyAmount, resolutionType, result.reasoning);
        await tx.wait();
    }
    getResolutionType(decision) {
        const resolutionTypes = {
            'FullArtistPayment': 0,
            'PartialPayment': 1,
            'FullVenueRefund': 2,
            'PenaltyApplied': 3,
            'TicketRefunds': 4
        };
        return resolutionTypes[decision] || 0;
    }
    parseContractTerms(termsData) {
        try {
            return JSON.parse(termsData);
        }
        catch {
            return {};
        }
    }
    parseEvidence(evidenceData) {
        try {
            return JSON.parse(evidenceData);
        }
        catch {
            return [];
        }
    }
}
exports.ArbitrationService = ArbitrationService;
