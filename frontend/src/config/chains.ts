/**
 * Chain configuration for local, testnet, and mainnet.
 * Set NEXT_PUBLIC_CHAIN_ID to target the desired environment:
 * - 637173: Revive Testnet (default)
 * - 1337: Revive Local (revive-dev-node + eth-rpc at 127.0.0.1:8545)
 * - 31337: Hardhat Local
 * - 11155111: Sepolia Testnet
 * - 1: Ethereum Mainnet
 */
export const CHAIN_IDS = {
  reviveTestnet: 637173,
  reviveLocal: 1337,
  local: 31337,
  sepolia: 11155111,
  mainnet: 1,
} as const;

export type ChainEnv = keyof typeof CHAIN_IDS;

export const TARGET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || "637173"
) as number;

export const CHAIN_LABELS: Record<number, string> = {
  [CHAIN_IDS.reviveTestnet]: "Revive Testnet",
  [CHAIN_IDS.reviveLocal]: "Revive Local",
  [CHAIN_IDS.local]: "Hardhat Local",
  [CHAIN_IDS.sepolia]: "Sepolia",
  [CHAIN_IDS.mainnet]: "Ethereum Mainnet",
};

export function getChainLabel(chainId: number): string {
  return CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;
}
