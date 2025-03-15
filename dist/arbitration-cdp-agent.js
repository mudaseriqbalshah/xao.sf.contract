"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdpArbitrationAgent = exports.ResolutionType = void 0;
const agentkit_1 = require("@coinbase/agentkit");
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
class CdpArbitrationAgent {
    constructor(apiKey, provider) {
        this.evidenceDatabase = [];
        this.contractTerms = {};
        this.tasks = new Map();
        this.updateCallbacks = [];
        this.openai = new openai_1.OpenAI({ apiKey });
        // Initialize AgentKit with all required providers
        this.agentKit = new agentkit_1.AgentKit({
            walletProvider: new agentkit_1.CdpWalletProvider({
                provider,
                actions: [
                    agentkit_1.walletActionProvider,
                    agentkit_1.wethActionProvider,
                    agentkit_1.erc20ActionProvider,
                    agentkit_1.cdpApiActionProvider,
                    agentkit_1.cdpWalletActionProvider,
                    agentkit_1.pythActionProvider
                ]
            })
        });
    }
    // CDP-style task management
    createTask(id) {
        const task = { id, status: 'pending' };
        this.tasks.set(id, task);
        return task;
    }
    completeTask(taskId, result) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.result = result;
            this.notifyUpdate({
                message: `Task ${taskId} completed`,
                taskId,
                evidence: result
            });
        }
    }
    failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'failed';
            task.message = error;
            this.notifyUpdate({
                message: `Task ${taskId} failed: ${error}`,
                taskId
            });
        }
    }
    // Event notification system
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }
    notifyUpdate(update) {
        this.updateCallbacks.forEach(callback => callback(update));
    }
    // Core arbitration functionality
    async processEvidence(evidence) {
        const taskId = `evidence-${Date.now()}`;
        const task = this.createTask(taskId);
        try {
            if (!this.validateEvidence(evidence)) {
                throw new Error('Invalid evidence format');
            }
            this.evidenceDatabase.push(evidence);
            this.completeTask(taskId, evidence);
            this.notifyUpdate({
                message: 'Evidence processed successfully',
                evidence
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.failTask(taskId, errorMessage);
            throw error;
        }
    }
    validateEvidence(evidence) {
        return (evidence.timestamp > 0 &&
            ['artist', 'venue'].includes(evidence.party) &&
            ['contract', 'performance', 'payment', 'media'].includes(evidence.evidenceType) &&
            evidence.content !== null &&
            typeof evidence.ipfsHash === 'string');
    }
    analyzeContractTerms(terms) {
        const taskId = `analyze-contract-${Date.now()}`;
        const task = this.createTask(taskId);
        try {
            this.contractTerms = terms;
            this.completeTask(taskId, {
                message: 'Contract terms analyzed',
                terms
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.failTask(taskId, errorMessage);
            throw error;
        }
    }
    async generateDecision() {
        const taskId = `decision-${Date.now()}`;
        const task = this.createTask(taskId);
        try {
            const performanceMetrics = await this.evaluatePerformance();
            const paymentCompliance = await this.evaluatePaymentCompliance();
            const contractViolations = await this.checkContractViolations();
            const artistPayment = this.calculateArtistPayment(performanceMetrics);
            const venueRefund = this.calculateVenueRefund(contractViolations);
            const penalties = this.calculatePenalties(contractViolations);
            const requiresRefunds = this.checkIfRefundsNeeded(performanceMetrics);
            const reasoning = await this.generateDecisionReasoning(performanceMetrics, paymentCompliance, contractViolations);
            const confidenceScore = this.calculateConfidenceScore();
            const result = {
                decision: this.getDecisionType(artistPayment, venueRefund),
                artistPaymentPercentage: artistPayment,
                venueRefundPercentage: venueRefund,
                penaltyAmount: ethers_1.ethers.utils.parseEther(penalties.toString()),
                requiresTicketRefunds: requiresRefunds,
                reasoning,
                confidenceScore
            };
            this.completeTask(taskId, result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.failTask(taskId, errorMessage);
            throw error;
        }
    }
    async evaluatePerformance() {
        const taskId = `evaluate-performance-${Date.now()}`;
        const task = this.createTask(taskId);
        try {
            const metrics = {
                timeCompliance: await this.calculateTimeCompliance(),
                technicalRequirementsMet: await this.verifyTechnicalRequirements(),
                audienceFeedback: await this.analyzeSentiment()
            };
            this.completeTask(taskId, metrics);
            return metrics;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.failTask(taskId, errorMessage);
            throw error;
        }
    }
    async analyzeSentiment() {
        const feedbackEvidence = this.evidenceDatabase.filter(e => e.evidenceType === 'performance');
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
        }
        catch (error) {
            console.error('Sentiment analysis failed:', error);
            return 0.5; // Default neutral score
        }
    }
    // Additional helper methods with CDP-style task tracking
    async calculateTimeCompliance() {
        // Implementation details similar to Python version
        return 0.8;
    }
    async verifyTechnicalRequirements() {
        // Implementation details similar to Python version
        return 0.9;
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
    async evaluatePaymentCompliance() {
        return {};
    }
    async checkContractViolations() {
        return [];
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
    async generateDecisionReasoning(metrics, paymentCompliance, violations) {
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
        }
        catch (error) {
            console.error('Failed to generate decision reasoning:', error);
            return "Decision reasoning generation failed";
        }
    }
}
exports.CdpArbitrationAgent = CdpArbitrationAgent;
