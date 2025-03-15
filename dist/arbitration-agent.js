"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitrationAgent = exports.ResolutionType = void 0;
const openai_1 = require("openai");
const ethers_1 = require("ethers");
var ResolutionType;
(function (ResolutionType) {
    ResolutionType["FullArtistPayment"] = "FullArtistPayment";
    ResolutionType["PartialPayment"] = "PartialPayment";
    ResolutionType["FullVenueRefund"] = "FullVenueRefund";
    ResolutionType["PenaltyApplied"] = "PenaltyApplied";
    ResolutionType["TicketRefunds"] = "TicketRefunds";
})(ResolutionType || (exports.ResolutionType = ResolutionType = {}));
class ArbitrationAgent {
    constructor(apiKey) {
        this.evidenceDatabase = [];
        this.contractTerms = {};
        const configuration = new openai_1.Configuration({ apiKey });
        this.openai = new openai_1.OpenAIApi(configuration);
    }
    async processEvidence(evidence) {
        if (!this.validateEvidence(evidence)) {
            throw new Error('Invalid evidence format');
        }
        this.evidenceDatabase.push(evidence);
    }
    validateEvidence(evidence) {
        return (evidence.timestamp > 0 &&
            ['artist', 'venue'].includes(evidence.party) &&
            ['contract', 'performance', 'payment', 'media'].includes(evidence.evidenceType) &&
            evidence.content !== null &&
            typeof evidence.ipfsHash === 'string');
    }
    analyzeContractTerms(terms) {
        this.contractTerms = terms;
    }
    async generateDecision() {
        const performanceMetrics = await this.evaluatePerformance();
        const paymentCompliance = await this.evaluatePaymentCompliance();
        const contractViolations = await this.checkContractViolations();
        const artistPayment = this.calculateArtistPayment(performanceMetrics);
        const venueRefund = this.calculateVenueRefund(contractViolations);
        const penalties = this.calculatePenalties(contractViolations);
        const requiresRefunds = this.checkIfRefundsNeeded(performanceMetrics);
        const reasoning = await this.generateDecisionReasoning(performanceMetrics, paymentCompliance, contractViolations);
        const confidenceScore = this.calculateConfidenceScore();
        return {
            decision: this.getDecisionType(artistPayment, venueRefund),
            artistPaymentPercentage: artistPayment,
            venueRefundPercentage: venueRefund,
            penaltyAmount: ethers_1.ethers.utils.parseEther(penalties.toString()),
            requiresTicketRefunds: requiresRefunds,
            reasoning,
            confidenceScore
        };
    }
    async evaluatePerformance() {
        const performanceEvidence = this.evidenceDatabase.filter(e => e.evidenceType === 'performance');
        return {
            timeCompliance: await this.calculateTimeCompliance(),
            technicalRequirementsMet: await this.verifyTechnicalRequirements(),
            audienceFeedback: await this.analyzeSentiment()
        };
    }
    async analyzeSentiment() {
        const feedbackEvidence = this.evidenceDatabase.filter(e => e.evidenceType === 'performance');
        if (feedbackEvidence.length === 0) {
            return 0.8; // Default positive if no negative feedback
        }
        try {
            const response = await this.openai.createChatCompletion({
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
            const score = parseFloat(response.data.choices[0]?.message?.content || "0.5");
            return Math.max(0, Math.min(1, score));
        }
        catch (error) {
            console.error('Sentiment analysis failed:', error);
            return 0.5; // Default neutral score
        }
    }
    async generateDecisionReasoning(metrics, paymentCompliance, violations) {
        try {
            const response = await this.openai.createChatCompletion({
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
            return response.data.choices[0]?.message?.content ||
                "Unable to generate reasoning";
        }
        catch (error) {
            console.error('Failed to generate decision reasoning:', error);
            return "Decision reasoning generation failed";
        }
    }
    calculateArtistPayment(metrics) {
        const weights = {
            timeCompliance: 0.4,
            technicalRequirementsMet: 0.3,
            audienceFeedback: 0.3
        };
        let weightedScore = 0;
        let totalWeight = 0;
        for (const [metric, weight] of Object.entries(weights)) {
            const value = metrics[metric];
            if (value !== null) {
                weightedScore += value * weight;
                totalWeight += weight;
            }
        }
        return totalWeight > 0 ? weightedScore / totalWeight : 0;
    }
    getDecisionType(artistPayment, venueRefund) {
        if (artistPayment > 0.9) {
            return ResolutionType.FullArtistPayment;
        }
        else if (venueRefund > 0.9) {
            return ResolutionType.FullVenueRefund;
        }
        else if (artistPayment > 0) {
            return ResolutionType.PartialPayment;
        }
        return ResolutionType.PenaltyApplied;
    }
    // Placeholder methods to be implemented based on specific requirements
    async calculateTimeCompliance() {
        return 0.8;
    }
    async verifyTechnicalRequirements() {
        return 0.9;
    }
    calculateVenueRefund(violations) {
        return violations.length > 0 ? 0.5 : 0;
    }
    calculatePenalties(violations) {
        return violations.length * 0.1;
    }
    checkIfRefundsNeeded(metrics) {
        return metrics.timeCompliance < 0.5 || metrics.technicalRequirementsMet < 0.3;
    }
    calculateConfidenceScore() {
        return 0.85;
    }
    async evaluatePaymentCompliance() {
        return {};
    }
    async checkContractViolations() {
        return [];
    }
}
exports.ArbitrationAgent = ArbitrationAgent;
