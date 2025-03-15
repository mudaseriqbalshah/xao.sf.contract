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
export declare class ArbitrationAgent {
    private openai;
    private evidenceDatabase;
    private contractTerms;
    constructor(apiKey: string);
    processEvidence(evidence: ArbitrationEvidence): Promise<void>;
    private validateEvidence;
    analyzeContractTerms(terms: Record<string, any>): void;
    generateDecision(): Promise<ArbitrationResult>;
    private evaluatePerformance;
    private analyzeSentiment;
    private generateDecisionReasoning;
    private calculateArtistPayment;
    private getDecisionType;
    private calculateTimeCompliance;
    private verifyTechnicalRequirements;
    private calculateVenueRefund;
    private calculatePenalties;
    private checkIfRefundsNeeded;
    private calculateConfidenceScore;
    private evaluatePaymentCompliance;
    private checkContractViolations;
}
