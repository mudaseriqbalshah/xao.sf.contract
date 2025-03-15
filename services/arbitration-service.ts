import { ethers } from 'ethers';
import { CdpArbitrationAgent, ArbitrationResult, ArbitrationEvidence } from './arbitration-cdp-agent';

export class ArbitrationService {
    private agent: CdpArbitrationAgent;
    private provider: ethers.providers.Provider;
    private signer: ethers.Signer;

    constructor(
        openaiApiKey: string,
        provider: ethers.providers.Provider,
        signer: ethers.Signer
    ) {
        this.agent = new CdpArbitrationAgent(openaiApiKey, provider);
        this.provider = provider;
        this.signer = signer;
    }

    public async verifyOwnership(contractAddress: string): Promise<boolean> {
        const abi = [
            "function owner() view returns (address)"
        ];
        const contract = new ethers.Contract(contractAddress, abi, this.provider);
        const owner = await contract.owner();
        const currentAddress = await this.signer.getAddress();
        return owner.toLowerCase() === currentAddress.toLowerCase();
    }

    public async handleDispute(disputeId: number, contractAddress: string): Promise<{
        disputeId: number;
        decision: string;
        reasoning: string;
        confidence: number;
    }> {
        // Get dispute details from smart contract
        const dispute = await this.getDisputeDetails(disputeId, contractAddress);

        // Process contract terms
        this.agent.analyzeContractTerms(dispute.contractTerms);

        // Process evidence
        await this.agent.processEvidence(dispute.evidence as ArbitrationEvidence);

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

    private async getDisputeDetails(disputeId: number, contractAddress: string): Promise<any> {
        const abi = [
            "function getDisputeDetails(uint256 disputeId) view returns (address artist, address venue, address eventContract, uint256 contractAmount, uint256 depositAmount, uint256 filingTime, address initiator, bool evidenceComplete, bool aiDecisionIssued, bool isAppealed, bytes32 evidenceIPFSHash, bytes32 aiDecisionIPFSHash, uint256 approvedAmount, bool refundsRequired, uint256 penaltyAmount, bool isResolved, uint8 status, uint256[] memory ticketIds, bool refundsProcessed, uint8 resolutionType, string memory resolutionDetails)"
        ];
        const contract = new ethers.Contract(contractAddress, abi, this.provider);
        const details = await contract.getDisputeDetails(disputeId);

        return {
            artist: details.artist,
            venue: details.venue,
            eventContract: details.eventContract,
            contractAmount: details.contractAmount,
            evidenceComplete: details.evidenceComplete,
            evidenceIPFSHash: details.evidenceIPFSHash,
            contractTerms: this.parseContractTerms(details),
            evidence: this.parseEvidence(details)
        };
    }

    private async submitDecision(
        disputeId: number,
        contractAddress: string,
        result: ArbitrationResult
    ): Promise<void> {
        const abi = [
            "function submitAIDecision(uint256 disputeId, bytes32 decisionHash, uint256 approvedAmount, bool refundsRequired, uint256 penaltyAmount, uint8 resolutionType, string memory resolutionDetails) external"
        ];
        const contract = new ethers.Contract(contractAddress, abi, this.signer);
        const resolutionType = this.getResolutionType(result.decision);

        const tx = await contract.submitAIDecision(
            disputeId,
            ethers.utils.id(result.reasoning),
            ethers.utils.parseEther(result.artistPaymentPercentage.toString()),
            result.requiresTicketRefunds,
            result.penaltyAmount,
            resolutionType,
            result.reasoning
        );

        await tx.wait();
    }

    private getResolutionType(decision: string): number {
        const resolutionTypes = {
            'FullArtistPayment': 0,
            'PartialPayment': 1,
            'FullVenueRefund': 2,
            'PenaltyApplied': 3,
            'TicketRefunds': 4
        };

        return resolutionTypes[decision as keyof typeof resolutionTypes] || 0;
    }

    private parseContractTerms(details: any): Record<string, any> {
        return {
            performance_requirements: {
                contractAmount: details.contractAmount.toString(),
                depositAmount: details.depositAmount.toString(),
                filingTime: details.filingTime.toString()
            }
        };
    }

    private parseEvidence(details: any): Array<any> {
        return [{
            timestamp: Date.now(),
            party: 'system',
            evidenceType: 'contract',
            content: {
                evidenceIPFSHash: details.evidenceIPFSHash,
                evidenceComplete: details.evidenceComplete
            },
            ipfsHash: details.evidenceIPFSHash
        }];
    }
}