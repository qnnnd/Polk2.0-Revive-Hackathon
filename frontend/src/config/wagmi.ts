import { http, createConfig, createStorage } from "wagmi";
import { hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

export const config = createConfig({
  chains: [hardhat],
  connectors: [injected()],
  storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined }),
  transports: {
    [hardhat.id]: http(rpcUrl),
  },
  ssr: true,
});
