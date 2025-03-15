require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 30000000,  // Increased gas limit
      gasPrice: 20000000000
    },
    test: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*",
      gas: 30000000,  // Increased gas limit
      gasPrice: 20000000000,
      skipDryRun: true
    },
    sepolia_base: {
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: `https://rpc.ankr.com/base_sepolia/d8b45c6ca36d9f7e8f419eaf46b61b646e579e1c2e724865e3a8da0a5974fd8f`,
        pollingInterval: 8000,
        shareNonce: true,
        derivationPath: `m/44'/60'/0'/0/`
      }),
      network_id: 84532,
      gas: 5000000,               // Reduced gas limit
      gasPrice: 1000000000,       // 1 gwei
      confirmations: 5,           // Increased confirmations
      timeoutBlocks: 500,         // Increased timeout blocks
      skipDryRun: true,
      networkCheckTimeout: 60000, // Increased network timeout
      verify: {
        apiUrl: 'https://api-sepolia.basescan.org'
      }
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        viaIR: true,  // Enable IR-based code generation
        optimizer: {
          enabled: true,
          runs: 200,
          details: {
            yul: true,  // Enable Yul optimizer
            yulDetails: {
              stackAllocation: true,  // Enable stack allocation optimizations
              optimizerSteps: "dhfoDgvulfnTUtnIf"  // Aggressive optimization
            }
          }
        }
      }
    }
  },
  plugins: ['truffle-plugin-verify'],
  api_keys: {
    basescan: process.env.BASESCAN_API_KEY
  }
};