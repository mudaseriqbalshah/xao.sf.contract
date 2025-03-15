import { ethers } from 'ethers';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize logging
const logFile = 'deployment_log.json';
const deployments: any[] = [];

function writeLog(deployment: any) {
    deployments.push({
        ...deployment,
        timestamp: new Date().toISOString(),
        network: 'sepolia_base',
        networkId: 84532,
    });
    fs.writeFileSync(logFile, JSON.stringify(deployments, null, 2));
}

async function main() {
    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(
        "https://sepolia.base.org"
    );
    console.log('Provider initialized ✓');

    // Initialize signer
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const deployerAccount = await signer.getAddress();
    console.log('Signer address:', deployerAccount);

    // Deploy XAO Token
    console.log('Deploying XAO Token...');
    const XAOToken = await ethers.ContractFactory.fromSolidity(
        require('../artifacts/contracts/XAOToken.sol/XAOToken.json'),
        signer
    );
    const xaoToken = await XAOToken.deploy();
    await xaoToken.deployed();
    console.log('XAO Token deployed to:', xaoToken.address);
    writeLog({
        contractName: 'XAOToken',
        contractAddress: xaoToken.address,
        deployerAccount
    });

    // Deploy ArtistFactory
    console.log('Deploying ArtistFactory...');
    const ArtistFactory = await ethers.ContractFactory.fromSolidity(
        require('../artifacts/contracts/factories/ArtistFactory.sol/ArtistFactory.json'),
        signer
    );
    const artistFactory = await ArtistFactory.deploy();
    await artistFactory.deployed();
    console.log('ArtistFactory deployed to:', artistFactory.address);
    writeLog({
        contractName: 'ArtistFactory',
        contractAddress: artistFactory.address,
        deployerAccount
    });

    // Deploy EventFactory with ArtistFactory address
    console.log('Deploying EventFactory...');
    const EventFactory = await ethers.ContractFactory.fromSolidity(
        require('../artifacts/contracts/factories/EventFactory.sol/EventFactory.json'),
        signer
    );
    const eventCreationFee = ethers.utils.parseEther("0.01"); // 0.01 ETH fee
    const eventFactory = await EventFactory.deploy(eventCreationFee, artistFactory.address);
    await eventFactory.deployed();
    console.log('EventFactory deployed to:', eventFactory.address);
    writeLog({
        contractName: 'EventFactory',
        contractAddress: eventFactory.address,
        artistFactoryAddress: artistFactory.address,
        eventCreationFee: eventCreationFee.toString(),
        deployerAccount
    });

    // Set EventFactory in ArtistFactory
    console.log('Linking factories...');
    const setEventFactoryTx = await artistFactory.setEventFactory(eventFactory.address);
    await setEventFactoryTx.wait();
    console.log('Factories linked successfully ✓');

    // Deploy ArtistVenueArbitration
    console.log('Deploying ArtistVenueArbitration...');
    const ArtistVenueArbitration = await ethers.ContractFactory.fromSolidity(
        require('../artifacts/contracts/ArtistVenueArbitration.sol/ArtistVenueArbitration.json'),
        signer
    );
    const arbitration = await ArtistVenueArbitration.deploy(xaoToken.address);
    await arbitration.deployed();
    console.log('ArtistVenueArbitration deployed to:', arbitration.address);
    writeLog({
        contractName: 'ArtistVenueArbitration',
        contractAddress: arbitration.address,
        xaoTokenAddress: xaoToken.address,
        deployerAccount
    });

    console.log('All contracts deployed successfully!');
    console.log('Deployment logs written to:', logFile);
}

// Run deployment
if (require.main === module) {
    main().catch((error) => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
}
