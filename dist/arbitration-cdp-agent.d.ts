import { ethers } from 'ethers';
export interface ArbitrationEvidence {
    timestamp: number;
    party: 'artist' | 'venue';
    evidenceType: 'contract' | 'performance' | 'payment' | 'media';
    content: Record<string, any>;
    ipfsHash: string;
}
export interface PerformanceMetrics {
    timeCompliance: number;
    technicalRequirementsMet: number;
    audienceFeedback: number | null;
}
export interface ArbitrationResult {
    decision: ResolutionType;
    artistPaymentPercentage: number;
    venueRefundPercentage: number;
    penaltyAmount: ethers.BigNumber;
    requiresTicketRefunds: boolean;
    reasoning: string;
    confidenceScore: number;
}
export declare enum ResolutionType {
    FullArtistPayment = "FullArtistPayment",
    PartialPayment = "PartialPayment",
    FullVenueRefund = "FullVenueRefund",
    PenaltyApplied = "PenaltyApplied",
    TicketRefunds = "TicketRefunds"
}
interface AgentUpdate {
    message: string;
    evidence?: any;
    taskId?: string;
}
export declare class CdpArbitrationAgent {
    private agentKit;
    private openai;
    private evidenceDatabase;
    private contractTerms;
    private tasks;
    private updateCallbacks;
    constructor(apiKey: string, provider: ethers.providers.Provider);
    private createTask;
    private completeTask;
    private failTask;
    onUpdate(callback: (update: AgentUpdate) => void): void;
    private notifyUpdate;
    processEvidence(evidence: ArbitrationEvidence): Promise<void>;
    private validateEvidence;
    analyzeContractTerms(terms: Record<string, any>): void;
    generateDecision(): Promise<ArbitrationResult>;
    private evaluatePerformance;
    private analyzeSentiment;
    private calculateTimeCompliance;
    private verifyTechnicalRequirements;
    private calculateArtistPayment;
    private getDecisionType;
    private evaluatePaymentCompliance;
    private checkContractViolations;
    private calculateVenueRefund;
    private calculatePenalties;
    private checkIfRefundsNeeded;
    private calculateConfidenceScore;
    private generateDecisionReasoning;
}
export {};
