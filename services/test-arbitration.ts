import { ethers } from 'ethers';
import { ArbitrationService } from './arbitration-service';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Initialize logging
const logFile = 'arbitration_test.log';
function writeLog(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(logFile, logMessage);
}

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
        process.exit(1);
    }

    writeLog("Environment validation complete ✓");
}

async function waitForTransaction(provider: ethers.providers.Provider, txHash: string, timeout: number = 180000): Promise<ethers.providers.TransactionReceipt> {
    const startTime = Date.now();
    let receipt: ethers.providers.TransactionReceipt | null = null;

    while (!receipt && Date.now() - startTime < timeout) {
        try {
            receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) {
                writeLog(`Waiting for transaction ${txHash} to be mined... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before next check
            }
        } catch (error) {
            writeLog(`Error checking transaction receipt: ${error}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    if (!receipt) {
        throw new Error(`Transaction confirmation timeout after ${timeout/1000} seconds`);
    }

    return receipt;
}

async function getEventCreationFee(eventFactory: ethers.Contract): Promise<ethers.BigNumber> {
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
        try {
            writeLog(`Attempting to get event creation fee (${retries} retries left)...`);
            const fee = await eventFactory.eventCreationFee();
            writeLog(`Successfully got event creation fee: ${ethers.utils.formatEther(fee)} ETH`);
            return fee;
        } catch (error) {
            lastError = error as Error;
            writeLog(`Error getting event creation fee: ${error}`);
            retries--;
            if (retries > 0) {
                writeLog('Retrying in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    throw new Error(`Failed to get event creation fee after multiple attempts: ${lastError?.message}`);
}

async function testArbitrationAgent() {
    try {
        writeLog('Starting arbitration agent test on Base Sepolia...');

        // Validate environment first
        validateEnvironment();

        // Initialize provider with retry mechanism
        const provider = new ethers.providers.StaticJsonRpcProvider(
            "https://sepolia.base.org",
            {
                chainId: 84532,
                name: 'base-sepolia'
            }
        );

        // Add provider error handler
        provider.on("error", (error) => {
            writeLog(`Provider error: ${error}`);
        });

        writeLog('Provider initialized ✓');

        // Initialize signer
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const signerAddress = await signer.getAddress();
        writeLog('Signer address: ' + signerAddress);

        // Contract addresses on Base Sepolia
        const EVENT_FACTORY_ADDRESS = "0xcF16D92296Ab0eb63E98b27d3945c643a9C4da6f";
        const ARTIST_FACTORY_ADDRESS = "0xE10Aff9A69A8058CD3a8E66bB76B3b61bB40b69E";
        const ARBITRATION_ADDRESS = "0xf0e300c6768dfc4add0b71d1d028e3c1a7643bd7";

        writeLog(`Using EventFactory at: ${EVENT_FACTORY_ADDRESS}`);
        writeLog(`Using ArtistFactory at: ${ARTIST_FACTORY_ADDRESS}`);
        writeLog(`Using Arbitration at: ${ARBITRATION_ADDRESS}`);

        // Initialize contracts with higher gas limit
        const eventFactoryAbi = [
            "function createEvent() external payable returns (address)",
            "function eventCreationFee() view returns (uint256)",
            "function artistFactory() view returns (address)",
            "event EventCreated(address indexed eventAddress, address indexed creator)"
        ];
        const eventFactory = new ethers.Contract(EVENT_FACTORY_ADDRESS, eventFactoryAbi, signer);

        // Validate factory setup with retries
        writeLog('Validating factory setup...');
        let configuredArtistFactory;
        try {
            configuredArtistFactory = await eventFactory.artistFactory();
            writeLog(`Configured ArtistFactory: ${configuredArtistFactory}`);
            if (configuredArtistFactory.toLowerCase() !== ARTIST_FACTORY_ADDRESS.toLowerCase()) {
                throw new Error('ArtistFactory address mismatch in EventFactory configuration');
            }
        } catch (error) {
            writeLog(`Error validating factory setup: ${error}`);
            throw error;
        }

        // Get event creation fee with retry mechanism
        const eventCreationFee = await getEventCreationFee(eventFactory);

        // Get and verify signer balance
        const signerBalance = await provider.getBalance(signerAddress);
        writeLog(`Signer balance: ${ethers.utils.formatEther(signerBalance)} ETH`);

        if (signerBalance.lt(eventCreationFee)) {
            throw new Error(`Insufficient balance to create event. Required: ${ethers.utils.formatEther(eventCreationFee)} ETH, Available: ${ethers.utils.formatEther(signerBalance)} ETH`);
        }

        // Try call-static first to get potential revert reason
        writeLog('Checking event creation with call-static...');
        try {
            writeLog('Estimating gas for event creation...');
            const gasEstimate = await eventFactory.estimateGas.createEvent({ 
                value: eventCreationFee 
            });
            writeLog(`Estimated gas: ${gasEstimate.toString()}`);

            writeLog('Performing call-static check...');
            await eventFactory.callStatic.createEvent({ 
                value: eventCreationFee,
                gasLimit: gasEstimate.mul(2)
            });
            writeLog('Call-static check passed ✓');

            // Create new event with optimized gas parameters
            writeLog('Creating new event...');
            const createEventTx = await eventFactory.createEvent({ 
                value: eventCreationFee,
                gasLimit: gasEstimate.mul(2),
                maxFeePerGas: ethers.utils.parseUnits('5', 'gwei'),
                maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei')
            });

            writeLog(`Event creation transaction hash: ${createEventTx.hash}`);
            writeLog('Waiting for event creation transaction...');

            // Wait for transaction with extended timeout
            const createEventReceipt = await waitForTransaction(provider, createEventTx.hash, 300000); // 5 minutes timeout

            writeLog(`Transaction mined at block ${createEventReceipt.blockNumber}`);
            writeLog(`Gas used: ${createEventReceipt.gasUsed.toString()}`);

            if (!createEventReceipt.status) {
                throw new Error(`Event creation failed. Gas used: ${createEventReceipt.gasUsed.toString()}`);
            }

            const eventCreatedLog = createEventReceipt.logs.find(
                (log: ethers.providers.Log) => log.topics[0] === ethers.utils.id("EventCreated(address,address)")
            );
            if (!eventCreatedLog) {
                throw new Error('Event creation log not found');
            }

            const eventAddress = ethers.utils.defaultAbiCoder.decode(
                ['address'],
                eventCreatedLog.topics[1]
            )[0];
            writeLog(`New event created at address: ${eventAddress}`);

            // Initialize event contract
            const eventContractAbi = [
                "function owner() view returns (address)",
                "function isArtistLinked(address) view returns (bool)",
                "function artistFactory() view returns (address)",
                "function linkArtistContract(address) external"
            ];
            const eventContract = new ethers.Contract(eventAddress, eventContractAbi, signer);

            // Verify event contract ownership
            const eventOwner = await eventContract.owner();
            writeLog(`Event contract owner: ${eventOwner}`);
            if (eventOwner.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error('Event contract ownership not transferred correctly');
            }

            // Initialize ArtistFactory contract
            const artistFactoryAbi = [
                "function createArtistContract(address _eventContract, address _artist) external returns (address)",
                "function isArtist(address) view returns (bool)",
                "function eventFactory() view returns (address)",
                "event ArtistCreated(address indexed artistContract, address indexed artist, address indexed eventContract)"
            ];
            const artistFactory = new ethers.Contract(ARTIST_FACTORY_ADDRESS, artistFactoryAbi, signer);

            // Create artist contract
            writeLog('Creating artist contract...');
            writeLog('Checking artist contract creation with call-static...');
            try {
                // First verify event contract in artist factory
                const configuredEventFactory = await artistFactory.eventFactory();
                writeLog(`ArtistFactory's EventFactory: ${configuredEventFactory}`);
                if (configuredEventFactory.toLowerCase() !== EVENT_FACTORY_ADDRESS.toLowerCase()) {
                    throw new Error('EventFactory address mismatch in ArtistFactory configuration');
                }

                // Pre-approve the artist factory in event contract
                const approveTx = await eventContract.linkArtistContract(ARTIST_FACTORY_ADDRESS);
                writeLog('Waiting for approval transaction...');
                await approveTx.wait(3); // Wait for 3 confirmations
                writeLog('Artist factory approved in event contract ✓');

                // Estimate gas for artist contract creation
                const gasEstimateArtist = await artistFactory.estimateGas.createArtistContract(
                    eventAddress,
                    signerAddress
                );
                writeLog(`Estimated gas for artist creation: ${gasEstimateArtist.toString()}`);

                await artistFactory.callStatic.createArtistContract(
                    eventAddress,
                    signerAddress,
                    { 
                        gasLimit: gasEstimateArtist.mul(2)
                    }
                );
                writeLog('Artist contract call-static check passed ✓');

                const createArtistTx = await artistFactory.createArtistContract(
                    eventAddress,
                    signerAddress,
                    { 
                        gasLimit: gasEstimateArtist.mul(2),
                        maxFeePerGas: ethers.utils.parseUnits('5', 'gwei'), // Increased gas price
                        maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei') // Increased priority fee
                    }
                );

                writeLog(`Artist creation transaction hash: ${createArtistTx.hash}`);
                writeLog('Waiting for artist creation transaction...');

                const createArtistReceipt = await waitForTransaction(provider, createArtistTx.hash, 180000); // 3 minutes timeout
                if (!createArtistReceipt.status) {
                    throw new Error(`Artist creation failed. Gas used: ${createArtistReceipt.gasUsed.toString()}`);
                }

                const artistCreatedLog = createArtistReceipt.logs.find(
                    (log: ethers.providers.Log) => log.topics[0] === ethers.utils.id("ArtistCreated(address,address,address)")
                );
                if (!artistCreatedLog) {
                    throw new Error('Artist creation log not found');
                }

                const artistContractAddress = ethers.utils.defaultAbiCoder.decode(
                    ['address'],
                    artistCreatedLog.topics[1]
                )[0];
                writeLog(`Artist contract created at address: ${artistContractAddress}`);

                // Initialize arbitration service
                writeLog('Initializing ArbitrationService...');
                const service = new ArbitrationService(
                    process.env.OPENAI_API_KEY!,
                    provider,
                    signer
                );
                writeLog('ArbitrationService initialized ✓');

                // Verify ownership of arbitration contract
                writeLog('Verifying arbitration contract ownership...');
                const isOwner = await service.verifyOwnership(ARBITRATION_ADDRESS);
                writeLog(`Is contract owner: ${isOwner}`);

                if (!isOwner) {
                    throw new Error('Signer is not the arbitration contract owner');
                }

                writeLog('CDP Agent initialized successfully');

                // Initialize arbitration contract
                const arbitrationAbi = [
                    "function getDisputeCount() view returns (uint256)",
                    "function fileDispute(address artist, address venue, address eventContract, uint256 contractAmount, uint256 depositAmount) external",
                    "function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external",
                    "function disputes(uint256) view returns (address artist, address venue, address eventContract, uint256 contractAmount, uint256 depositAmount, uint8 status)",
                    "function getDisputeDetails(uint256 disputeId) view returns (tuple(address artist, address venue, address eventContract, uint256 contractAmount, uint256 depositAmount, uint8 status))"
                ];
                const arbitrationContract = new ethers.Contract(ARBITRATION_ADDRESS, arbitrationAbi, signer);

                // Create test dispute
                writeLog('Creating test dispute...');

                // Create test dispute using real addresses
                const params = {
                    artist: artistContractAddress,
                    venue: signerAddress,
                    eventContract: eventAddress,
                    contractAmount: ethers.utils.parseEther("1.0"),
                    depositAmount: ethers.utils.parseEther("0.1")
                };

                writeLog(`Creating dispute with artist: ${params.artist}`);
                writeLog(`Venue address: ${params.venue}`);
                writeLog(`Event contract: ${params.eventContract}`);

                try {
                    // First check the dispute creation with call-static
                    writeLog('Checking dispute creation with call-static...');
                    await arbitrationContract.callStatic.fileDispute(
                        params.artist,
                        params.venue,
                        params.eventContract,
                        params.contractAmount,
                        params.depositAmount
                    );
                    writeLog('Dispute creation call-static check passed ✓');

                    const tx = await arbitrationContract.fileDispute(
                        params.artist,
                        params.venue,
                        params.eventContract,
                        params.contractAmount,
                        params.depositAmount,
                        { 
                            gasLimit: 500000,
                            maxFeePerGas: ethers.utils.parseUnits('5', 'gwei'), // Increased gas price
                            maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei') // Increased priority fee
                        }
                    );

                    writeLog('Waiting for dispute creation confirmation...');
                    const receipt = await waitForTransaction(provider, tx.hash, 180000); // 3 minutes timeout
                    if (!receipt.status) {
                        throw new Error(`Dispute creation failed. Gas used: ${receipt.gasUsed.toString()}`);
                    }
                    writeLog('Test dispute created successfully ✓');

                    // Submit evidence
                    const evidenceHash = ethers.utils.id("Test evidence for dispute");
                    const evidenceTx = await arbitrationContract.submitEvidence(
                        0, 
                        evidenceHash, 
                        { 
                            gasLimit: 300000,
                            maxFeePerGas: ethers.utils.parseUnits('5', 'gwei'), // Increased gas price
                            maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei') // Increased priority fee
                        }
                    );
                    await evidenceTx.wait(3); // Wait for 3 confirmations
                    writeLog('Evidence submitted successfully ✓');

                    // Process the dispute
                    writeLog('Processing dispute #0...');
                    const result = await service.handleDispute(0, ARBITRATION_ADDRESS);
                    writeLog('Dispute resolution result:');
                    writeLog(JSON.stringify(result, null, 2));

                    writeLog('Test completed successfully ✓');

                } catch (error: unknown) {
                    if (error instanceof Error) {
                        writeLog('Error creating dispute: ' + error.message);
                        if ('data' in error) {
                            try {
                                const errorData = (error as any).data;
                                if (errorData) {
                                    const decodedError = ethers.utils.toUtf8String(errorData);
                                    writeLog('Decoded error: ' + decodedError);
                                }
                            } catch (decodeError) {
                                writeLog('Could not decode error data');
                            }
                        }
                    } else {
                        writeLog('Error creating dispute: Unknown error');
                    }
                    throw error;
                }

            } catch (error: unknown) {
                if (error instanceof Error) {
                    writeLog('Error during artist contract creation: ' + error.message);
                    if ('data' in error) {
                        try {
                            const errorData = (error as any).data;
                            if (errorData) {
                                const decodedError = ethers.utils.toUtf8String(errorData);
                                writeLog('Decoded error: ' + decodedError);
                            }
                        } catch (decodeError) {
                            writeLog('Could not decode error data');
                        }
                    }
                    throw error;
                }
                throw error;
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                writeLog('Error during event creation: ' + error.message);
                if ('data' in error) {
                    try {
                        const errorData = (error as any).data;
                        if (errorData) {
                            const decodedError = ethers.utils.toUtf8String(errorData);
                            writeLog('Decoded error: ' + decodedError);
                        }
                    } catch (decodeError) {
                        writeLog('Could not decode error data');
                    }
                }
                throw error;
            }
            throw error;
        }

    } catch (error: unknown) {
        if (error instanceof Error) {
            writeLog('Fatal error during test: ' + error.message);
        } else {
            writeLog('Fatal error during test: Unknown error');
        }
        throw error;
    }
}

// Run the test
if (require.main === module) {
    writeLog('Starting arbitration agent test...');
    testArbitrationAgent().catch(error => {
        if (error instanceof Error) {
            writeLog('Fatal error during test: ' + error.message);
        } else {
            writeLog('Fatal error during test: Unknown error');
        }
        process.exit(1);
    });
}