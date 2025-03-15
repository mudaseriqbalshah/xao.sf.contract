import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { ArbitrationService } from './arbitration-service';

dotenv.config();

// Initialize logging
const logFile = 'arbitration_debug.log';
function writeLog(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(logFile, logMessage);
}

// Validate environment variables before starting
function validateEnvironment(): void {
    const missingVars: string[] = [];

    const requiredVars = [
        "OPENAI_API_KEY",
        "CDP_API_KEY_NAME",
        "CDP_API_KEY_PRIVATE_KEY",
        "PRIVATE_KEY"
    ];

    requiredVars.forEach((varName) => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        writeLog("Error: Required environment variables are not set");
        missingVars.forEach((varName) => {
            writeLog(`${varName}=your_${varName.toLowerCase()}_here`);
        });
        process.exit(1);
    }

    writeLog("Environment validation complete ✓");
}

// Test the CDP agent as contract owner
async function testArbitrationAgent() {
    try {
        writeLog('Starting CDP Arbitration test...');

        // Validate environment first
        validateEnvironment();

        // Set up provider for Base Sepolia
        const provider = new ethers.providers.JsonRpcProvider(
            "https://sepolia.base.org"
        );
        writeLog('Provider initialized ✓');

        const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        writeLog('Signer initialized ✓');

        const CONTRACT_ADDRESS = "0x5Dd5b5Ed92Bc34c042a9CE97Ab179fce4909B64f";

        // Initialize the arbitration service
        writeLog('Initializing Arbitration Service...');
        const service = new ArbitrationService(
            process.env.OPENAI_API_KEY!,
            provider,
            signer
        );

        // Verify CDP agent is contract owner
        const isOwner = await service.verifyOwnership(CONTRACT_ADDRESS);
        writeLog(`CDP Agent is contract owner: ${isOwner}`);

        if (!isOwner) {
            throw new Error('CDP Agent must be the contract owner to proceed');
        }

        // Create a test dispute for demonstration
        writeLog('Creating test dispute...');

        // Example dispute parameters
        const disputeParams = {
            artist: "0x1234567890123456789012345678901234567890",
            venue: "0x0987654321098765432109876543210987654321",
            eventContract: "0x5555555555555555555555555555555555555555",
            contractAmount: ethers.utils.parseEther("1.0"),
            depositAmount: ethers.utils.parseEther("0.1")
        };

        const disputeId = 1; // For testing an existing dispute
        writeLog('Processing dispute #1...');
        const result = await service.handleDispute(disputeId, CONTRACT_ADDRESS);
        writeLog('Dispute resolution result: ' + JSON.stringify(result, null, 2));

    } catch (error) {
        writeLog('Error during arbitration test: ' + error);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    writeLog('Starting CDP Arbitration test...');
    testArbitrationAgent().catch(error => {
        writeLog('Fatal error during arbitration test: ' + error);
        process.exit(1);
    });
}