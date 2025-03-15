"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arbitration_cdp_agent_1 = require("./arbitration-cdp-agent");
const ethers_1 = require("ethers");
// Example usage of the CDP-style arbitration agent
async function demonstrateArbitration() {
    // Set up provider
    const provider = new ethers_1.ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    // Initialize the agent with OpenAI API key and provider
    const agent = new arbitration_cdp_agent_1.CdpArbitrationAgent(process.env.OPENAI_API_KEY || '', provider);
    // Subscribe to agent updates
    agent.onUpdate(update => {
        console.log('Agent Update:', update.message);
        if (update.evidence) {
            console.log('Evidence processed:', update.evidence);
        }
        if (update.taskId) {
            console.log('Task ID:', update.taskId);
        }
    });
    try {
        // Example contract terms
        const contractTerms = {
            performance_requirements: {
                duration: 120,
                start_time: "20:00",
                technical_requirements: ["sound_system", "lighting"]
            },
            payment_terms: {
                base_amount: ethers_1.ethers.utils.parseEther("1.0"),
                bonus_conditions: {}
            }
        };
        // Process contract terms
        agent.analyzeContractTerms(contractTerms);
        // Example evidence
        const evidence = {
            timestamp: Date.now(),
            party: 'artist',
            evidenceType: 'performance',
            content: {
                actual_duration: 115,
                start_time: "20:05",
                technical_issues: []
            },
            ipfsHash: "QmX..."
        };
        // Process evidence
        await agent.processEvidence(evidence);
        // Generate decision
        const decision = await agent.generateDecision();
        console.log('Decision:', decision);
    }
    catch (error) {
        console.error('Error during arbitration:', error);
    }
}
// Run the example
if (require.main === module) {
    demonstrateArbitration().catch(console.error);
}
