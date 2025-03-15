// Type declarations for @coinbase/agentkit
declare module "@coinbase/agentkit" {
    export class AgentKit {
        static from(config: { 
            walletProvider: CdpWalletProvider;
            actionProviders: any[];
        }): Promise<AgentKit>;
    }

    export class CdpWalletProvider {
        static configureWithWallet(config: { 
            apiKeyName: string;
            apiKeyPrivateKey: string;
            networkId?: string;
            cdpWalletData?: string;
        }): Promise<CdpWalletProvider>;
    }

    export function wethActionProvider(): any;
    export function walletActionProvider(): any;
    export function erc20ActionProvider(): any;
    export function cdpApiActionProvider(config: {
        apiKeyName: string;
        apiKeyPrivateKey: string;
    }): any;
    export function cdpWalletActionProvider(config: {
        apiKeyName: string;
        apiKeyPrivateKey: string;
    }): any;
    export function pythActionProvider(): any;
}