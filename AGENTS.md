## Cursor Cloud specific instructions

### Project overview

Revive Bounty Board is a decentralized bounty/task platform. The repo has two main services:

- **contracts/** — Hardhat project with Solidity smart contract (`BountyBoard.sol`)
- **frontend/** — Next.js 14 app with wagmi/viem for blockchain interaction

**Must use Revive:** Functional testing and data verification are done on **Revive Testnet** (chainId 637173). The default frontend target chain is Revive.

### Running services (Revive Testnet — primary path)

1. **Deploy contract to Revive**: `cd contracts && pnpm run deploy:revive` — requires `PRIVATE_KEY` in `contracts/.env`, writes `frontend/.env.local` with contract address and chainId 637173.
2. **Frontend dev server**: `cd frontend && pnpm run dev` (port 3000) — connects to Revive by default.
3. **Smoke test on Revive** (optional): `cd contracts && pnpm run smoke:revive` — full flow (create → claim → submit → accept) on Revive; requires `PRIVATE_KEY` and `PRIVATE_KEY_WORKER` with IVE test tokens.

No local Hardhat node is needed for Revive-based functional testing.

### Running services (local Hardhat — unit tests / optional)

- **Hardhat local node**: `cd contracts && pnpm run node` (port 8545)
- **Deploy to local**: `cd contracts && pnpm run deploy:local` — writes `frontend/.env.local` for chainId 31337.
- Frontend can target local by setting `NEXT_PUBLIC_CHAIN_ID=31337` and using the contract address from deploy:local.

### Testing

- **Contract tests**: `cd contracts && pnpm run test` — 42 unit tests, no external dependencies needed.
- **Frontend build check**: `cd frontend && pnpm run build`
- **Frontend lint**: `cd frontend && pnpm run lint`
- **Revive smoke**: `cd contracts && pnpm run smoke:revive` (after deploy:revive; validates full flow on Revive Testnet).
- **Local demo**: `cd contracts && npx hardhat run scripts/demo.ts --network localhost` (requires running Hardhat node).

### Gotchas

- The `@metamask/sdk` produces a "Can't resolve @react-native-async-storage/async-storage" build warning — this is harmless and comes from wagmi's MetaMask connector; it does not affect functionality.
- Frontend wallet interaction requires MetaMask (or another injected wallet) configured for the target chain (default: Revive Testnet, chainId 637173). Without MetaMask, the frontend runs in read-only mode.
- After restarting the Hardhat node, you must redeploy the contract (`pnpm run deploy:local`) since the node state is reset.
- The `pnpm install` step may show "Ignored build scripts" warnings for `keccak` and `secp256k1` — these use JS fallbacks and do not affect functionality.
