import { configureChains, createConfig } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';

// Contract addresses deployed on Base Sepolia
export const CONTRACT_ADDRESSES = {
  ArtistFactory: '0x98b474B4faf1ee5Afa166F751d8fe6834747051B',
  EventFactory: '0xfF5D175141a4e6653ec4582E80df02df84D5aaa6',
  EventExplorer: '0x0b7F6bcf4651D044395fcfE1e1C7D5529f2cB709'
} as const;

// Configure chains and providers
const { chains, publicClient } = configureChains(
  [baseSepolia],
  [publicProvider()]
);

// Create Wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new MetaMaskConnector({ chains })],
  publicClient,
});
