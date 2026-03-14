## Cursor Cloud specific instructions

### Project overview

Revive Bounty Board is a decentralized bounty/task platform. The repo has two main services:

- **contracts/** — Hardhat project with Solidity smart contract (`BountyBoard.sol`)
- **frontend/** — Next.js 14 app with wagmi/viem for blockchain interaction

**Must use Revive:** For **local environment demo**, the requirement is to use the **local Revive node** (`revive-dev-node --dev` + `eth-rpc --dev`, EVM RPC at http://localhost:8545). The repo does not run Hardhat node as the "local chain" for demo; that path is optional for unit-test-only. See [docs/revive-local-node.md](docs/revive-local-node.md).

### Running services (local Revive node — required for "本地必须使用 Revive 本地节点")

For **local demo** (required for "本地必须使用 Revive 本地节点"): build and run **revive-dev-node** and **eth-rpc** from Polkadot SDK (see [docs/revive-local-node.md](docs/revive-local-node.md)). Then:

1. **Deploy**: `cd contracts && npm run deploy:revive-local` — writes `frontend/.env.local` with chainId 1337.
2. **Frontend**: `cd frontend && npm run dev`; set MetaMask to Revive Local (1337, http://127.0.0.1:8545).
3. **Smoke + data verification**: `cd contracts && npm run smoke:revive-local` — runs full flow and **verifies** on-chain data (task status, deliverableHash, reward paid, no forged data). See [docs/revive-local-node.md](docs/revive-local-node.md).

### Running services (Revive Testnet — remote, no local node)

1. **Deploy**: `cd contracts && pnpm run deploy:revive` — requires `PRIVATE_KEY` in `contracts/.env`, writes `frontend/.env.local` with chainId 637173.
2. **Frontend**: `cd frontend && pnpm run dev` — default chain is Revive Testnet.
3. **Smoke**: `cd contracts && pnpm run smoke:revive` — full flow on testnet; requires `PRIVATE_KEY` and `PRIVATE_KEY_WORKER` with IVE.

### Running services (local Hardhat — unit tests / optional, not Revive)

- **Hardhat local node**: `cd contracts && pnpm run node` (port 8545) — this is **Hardhat**, not Revive; `npm run node` does **not** start revive-dev-node or eth-rpc.
- **Deploy to local**: `cd contracts && pnpm run deploy:local` — deploys to Hardhat (chainId 31337), not to Revive local node.
- Frontend can target local by setting `NEXT_PUBLIC_CHAIN_ID=31337` and using the contract address from deploy:local. This path does **not** satisfy "本地必须使用 Revive 本地节点".

### Testing

- **Contract tests**: `cd contracts && pnpm run test` — 42 unit tests, no external dependencies needed.
- **Frontend build check**: `cd frontend && pnpm run build`
- **Frontend lint**: `cd frontend && pnpm run lint`
- **Revive smoke**: `cd contracts && pnpm run smoke:revive` (after deploy:revive; validates full flow on Revive Testnet).
- **Revive local smoke + data verification**: `cd contracts && npm run smoke:revive-local` (after revive-dev-node + eth-rpc and deploy:revive-local; asserts on-chain data).
- **Local demo**: `cd contracts && npx hardhat run scripts/demo.ts --network localhost` (requires running Hardhat node).

### Gotchas

- The `@metamask/sdk` produces a "Can't resolve @react-native-async-storage/async-storage" build warning — this is harmless and comes from wagmi's MetaMask connector; it does not affect functionality.
- Frontend wallet interaction requires MetaMask (or another injected wallet) configured for the target chain (default: Revive Testnet, chainId 637173). Without MetaMask, the frontend runs in read-only mode.
- After restarting the Hardhat node, you must redeploy the contract (`pnpm run deploy:local`) since the node state is reset.
- The `pnpm install` step may show "Ignored build scripts" warnings for `keccak` and `secp256k1` — these use JS fallbacks and do not affect functionality.
