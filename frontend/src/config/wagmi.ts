import { http, createConfig, createStorage } from "wagmi";
import { hardhat, mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { TARGET_CHAIN_ID } from "./chains";

const localRpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

export const config = createConfig({
  chains: [hardhat, sepolia, mainnet],
  connectors: [injected()],
  storage: createStorage({
    storage:
      typeof window !== "undefined" ? window.localStorage : undefined,
  }),
  transports: {
    [hardhat.id]: http(localRpcUrl),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || sepolia.rpcUrls.default.http[0]
    ),
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL || mainnet.rpcUrls.default.http[0]
    ),
  },
  ssr: true,
});

export { TARGET_CHAIN_ID };
