import { ethers } from 'ethers';
export declare class ArbitrationService {
    private agent;
    private provider;
    private signer;
    constructor(openaiApiKey: string, provider: ethers.providers.Provider, signer: ethers.Signer);
    handleDispute(disputeId: number, contractAddress: string): Promise<{
        disputeId: number;
        decision: string;
        reasoning: string;
        confidence: number;
    }>;
    private getDisputeDetails;
    private submitDecision;
    private getResolutionType;
    private parseContractTerms;
    private parseEvidence;
}
