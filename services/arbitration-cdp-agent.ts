import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { OpenAI } from 'openai';
import { ethers } from 'ethers';

// Evidence types and structures
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

export enum ResolutionType {
    FullArtistPayment = 'FullArtistPayment',
    PartialPayment = 'PartialPayment',
    FullVenueRefund = 'FullVenueRefund',
    PenaltyApplied = 'PenaltyApplied',
    TicketRefunds = 'TicketRefunds'
}

function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
  ];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    throw new Error("Missing required environment variables");
  }
}

export class CdpArbitrationAgent {
    private agentKit!: AgentKit;  // Using definite assignment assertion
    private openai: OpenAI;
    private evidenceDatabase: ArbitrationEvidence[] = [];
    private contractTerms: Record<string, any> = {};
    private walletProvider!: CdpWalletProvider;  // Using definite assignment assertion

    constructor(apiKey: string, provider: ethers.providers.Provider) {
        validateEnvironment();
        this.openai = new OpenAI({ apiKey });
        this.initializeAgent(provider);
    }

    private async initializeAgent(provider: ethers.providers.Provider) {
        try {
            // Initialize CDP Wallet Provider with configuration
            const config = {
                apiKeyName: process.env.CDP_API_KEY_NAME,
                apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                networkId: process.env.NETWORK_ID || "base-sepolia",
            };

            // Configure wallet provider
            this.walletProvider = await CdpWalletProvider.configureWithWallet(config);

            // Initialize AgentKit with configured wallet provider
            this.agentKit = await AgentKit.from({
                walletProvider: this.walletProvider,
                actionProviders: [
                    wethActionProvider(),
                    walletActionProvider(),
                    erc20ActionProvider(),
                    cdpApiActionProvider({
                        apiKeyName: process.env.CDP_API_KEY_NAME,
                        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                    }),
                    cdpWalletActionProvider({
                        apiKeyName: process.env.CDP_API_KEY_NAME,
                        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                    }),
                    pythActionProvider(),
                ],
            });

            console.log('CDP Agent initialized successfully');
        } catch (error) {
            console.error('Failed to initialize CDP Agent:', error);
            throw error;
        }
    }

    public async processEvidence(evidence: ArbitrationEvidence): Promise<void> {
        if (!this.validateEvidence(evidence)) {
            throw new Error('Invalid evidence format');
        }
        this.evidenceDatabase.push(evidence);
        console.log('Evidence processed:', evidence);
    }

    private validateEvidence(evidence: ArbitrationEvidence): boolean {
        return (
            evidence.timestamp > 0 &&
            ['artist', 'venue'].includes(evidence.party) &&
            ['contract', 'performance', 'payment', 'media'].includes(evidence.evidenceType) &&
            evidence.content !== null &&
            typeof evidence.ipfsHash === 'string'
        );
    }

    public analyzeContractTerms(terms: Record<string, any>): void {
        this.contractTerms = terms;
        console.log('Contract terms analyzed:', terms);
    }

    public async generateDecision(): Promise<ArbitrationResult> {
        try {
            console.log('Generating arbitration decision...');
            const performanceMetrics = await this.evaluatePerformance();
            console.log('Performance metrics:', performanceMetrics);

            const paymentCompliance = await this.evaluatePaymentCompliance();
            console.log('Payment compliance:', paymentCompliance);

            const contractViolations = await this.checkContractViolations();
            console.log('Contract violations:', contractViolations);

            const artistPayment = this.calculateArtistPayment(performanceMetrics);
            console.log('Calculated artist payment percentage:', artistPayment);

            const venueRefund = this.calculateVenueRefund(contractViolations);
            console.log('Calculated venue refund percentage:', venueRefund);

            const penalties = this.calculatePenalties(contractViolations);
            console.log('Calculated penalties:', penalties);

            const requiresRefunds = this.checkIfRefundsNeeded(performanceMetrics);

            const reasoning = await this.generateDecisionReasoning(
                performanceMetrics,
                paymentCompliance,
                contractViolations
            );

            const result: ArbitrationResult = {
                decision: this.getDecisionType(artistPayment, venueRefund),
                artistPaymentPercentage: artistPayment || 0,
                venueRefundPercentage: venueRefund || 0,
                penaltyAmount: ethers.utils.parseEther(penalties.toString() || '0'),
                requiresTicketRefunds: requiresRefunds,
                reasoning,
                confidenceScore: this.calculateConfidenceScore()
            };

            console.log('Generated decision:', {
                ...result,
                penaltyAmount: ethers.utils.formatEther(result.penaltyAmount)
            });

            return result;
        } catch (error) {
            console.error('Error generating decision:', error);
            throw error;
        }
    }

    private async evaluatePerformance(): Promise<PerformanceMetrics> {
        return {
            timeCompliance: await this.calculateTimeCompliance(),
            technicalRequirementsMet: await this.verifyTechnicalRequirements(),
            audienceFeedback: await this.analyzeSentiment()
        };
    }

    private async analyzeSentiment(): Promise<number> {
        const feedbackEvidence = this.evidenceDatabase.filter(
            e => e.evidenceType === 'performance'
        );

        if (feedbackEvidence.length === 0) {
            return 0.8; // Default positive if no negative feedback
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a sentiment analysis expert."
                    },
                    {
                        role: "user",
                        content: `Analyze the sentiment of this event feedback and rate it from 0 to 1:
                                ${JSON.stringify(feedbackEvidence[0].content)}`
                    }
                ]
            });

            const score = parseFloat(response.choices[0]?.message?.content || "0.5");
            return Math.max(0, Math.min(1, score));
        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            return 0.5; // Default neutral score
        }
    }

    // Additional helper methods
    private async calculateTimeCompliance(): Promise<number> {
        return 0.8;
    }

    private async verifyTechnicalRequirements(): Promise<number> {
        return 0.9;
    }

    private calculateArtistPayment(metrics: PerformanceMetrics): number {
        const weights = {
            timeCompliance: 0.4,
            technicalRequirementsMet: 0.3,
            audienceFeedback: 0.3
        };

        let weightedScore = 0;
        let totalWeight = 0;

        for (const [metric, weight] of Object.entries(weights)) {
            const value = metrics[metric as keyof PerformanceMetrics];
            if (value !== null) {
                weightedScore += value * weight;
                totalWeight += weight;
            }
        }

        return totalWeight > 0 ? weightedScore / totalWeight : 0;
    }

    private getDecisionType(artistPayment: number, venueRefund: number): ResolutionType {
        if (artistPayment > 0.9) {
            return ResolutionType.FullArtistPayment;
        } else if (venueRefund > 0.9) {
            return ResolutionType.FullVenueRefund;
        } else if (artistPayment > 0) {
            return ResolutionType.PartialPayment;
        }
        return ResolutionType.PenaltyApplied;
    }

    private async evaluatePaymentCompliance(): Promise<Record<string, any>> {
        return {};
    }

    private async checkContractViolations(): Promise<any[]> {
        return [];
    }

    private calculateVenueRefund(violations: any[]): number {
        return violations.length > 0 ? 0.5 : 0;
    }

    private calculatePenalties(violations: any[]): number {
        return violations.length * 0.1;
    }

    private checkIfRefundsNeeded(metrics: PerformanceMetrics): boolean {
        return metrics.timeCompliance < 0.5 || metrics.technicalRequirementsMet < 0.3;
    }

    private calculateConfidenceScore(): number {
        return 0.85;
    }

    private async generateDecisionReasoning(
        metrics: PerformanceMetrics,
        paymentCompliance: Record<string, any>,
        violations: Array<any>
    ): Promise<string> {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert arbitrator specializing in entertainment contracts."
                    },
                    {
                        role: "user",
                        content: `Generate a detailed arbitration decision based on:
                                Performance Metrics: ${JSON.stringify(metrics)}
                                Payment Compliance: ${JSON.stringify(paymentCompliance)}
                                Contract Violations: ${JSON.stringify(violations)}`
                    }
                ]
            });

            return response.choices[0]?.message?.content || 
                   "Unable to generate reasoning";
        } catch (error) {
            console.error('Failed to generate decision reasoning:', error);
            return "Decision reasoning generation failed";
        }
    }
}