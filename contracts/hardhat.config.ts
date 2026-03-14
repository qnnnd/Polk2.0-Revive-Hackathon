import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: Number(process.env.CHAIN_ID) || 31337,
    },
    reviveTestnet: {
      url: process.env.REVIVE_RPC_URL || "https://rpc-testnet.revive.global",
      chainId: 637173,
      accounts: [
        process.env.PRIVATE_KEY,
        process.env.PRIVATE_KEY_WORKER,
      ].filter((k): k is string => !!k),
    },
  },
};

export default config;
