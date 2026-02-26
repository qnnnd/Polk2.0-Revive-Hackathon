## Cursor Cloud specific instructions

### Project overview

Revive Bounty Board is a decentralized bounty/task platform. The repo has two main services:

- **contracts/** — Hardhat project with Solidity smart contract (`BountyBoard.sol`)
- **frontend/** — Next.js 14 app with wagmi/viem for blockchain interaction

### Running services

1. **Hardhat local node** (must run first): `cd contracts && pnpm run node` (port 8545)
2. **Deploy contract**: `cd contracts && pnpm run deploy:local` — writes `frontend/.env.local` automatically
3. **Frontend dev server**: `cd frontend && pnpm run dev` (port 3000)

The deploy script must run after the Hardhat node starts. It outputs the contract address into `frontend/.env.local`, which the frontend reads at startup.

### Testing

- **Contract tests**: `cd contracts && pnpm run test` — 42 unit tests, no external dependencies needed
- **Frontend build check**: `cd frontend && pnpm run build`
- **Frontend lint**: `cd frontend && pnpm run lint`
- **Full lifecycle demo script**: `cd contracts && npx hardhat run scripts/demo.ts --network localhost` (requires running Hardhat node)

### Gotchas

- The `@metamask/sdk` produces a "Can't resolve @react-native-async-storage/async-storage" build warning — this is harmless and comes from wagmi's MetaMask connector; it does not affect functionality.
- Frontend wallet interaction requires MetaMask (or another injected wallet) configured for chainId 31337. Without MetaMask, the frontend runs in read-only mode (displays on-chain data but cannot send transactions).
- After restarting the Hardhat node, you must redeploy the contract (`pnpm run deploy:local`) since the node state is reset.
- The `pnpm install` step may show "Ignored build scripts" warnings for `keccak` and `secp256k1` — these use JS fallbacks and do not affect functionality.
