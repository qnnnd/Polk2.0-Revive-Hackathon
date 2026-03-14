# Revive Bounty Board

链上托管赏金的任务平台：发布者创建任务并锁定奖金（Escrow），接单者认领并提交交付物，发布者验收后合约自动支付奖励。

> 基于 Revive/Polkadot 2.0 生态（EVM 兼容路径），Solidity + React/Next.js 全栈实现。

## 项目结构

```
repo/
  contracts/         # Hardhat — Solidity 智能合约 + 测试 + 部署脚本
  frontend/          # Next.js 14 — React 前端（wagmi + viem + Tailwind）
  docs/              # 技术方案文档 + UI 预览原型
```

## 快速开始

> **必须使用 Revive**：功能测试与数据验证在 Revive Testnet（chainId 637173）上完成。详见下方 **[Revive Testnet 实测步骤](#revive-testnet-实测步骤必须使用-revive)**。

### 环境要求

- Node.js ≥ 18（自带 npm）

### 1. 安装依赖

```bash
cd contracts && npm install
cd ../frontend && npm install
```

### 2. 编译 & 测试合约

```bash
cd contracts
npm run compile         # 编译 Solidity
npm run test            # 运行 42 条单元测试
```

### 3. 启动本地链 & 部署合约

```bash
# 终端 1：启动 Hardhat 本地节点
cd contracts
npm run node

# 终端 2：部署合约（自动写入 frontend/.env.local）
cd contracts
npm run deploy:local
```

### 4. 启动前端

```bash
cd frontend
npm run dev             # http://localhost:3000
```

### 5. 连接钱包

在 MetaMask 中添加 Hardhat 网络：

| 参数 | 值 |
|------|-----|
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| 货币符号 | `ETH` |

导入 Hardhat 默认账户（测试用私钥）：

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> ⚠️ 仅用于本地开发，切勿在主网使用此私钥。

**重要**：连接钱包后，dApp 会自动将 MetaMask 切换到目标网络（Revive 测试网 / 本地 / 其他）。发布任务或认领等操作前也会确保网络正确，避免交易发往错误链。

## Revive Testnet 实测步骤（必须使用 Revive）

功能测试与数据验证在 **Revive Testnet** 上完成，无需本地 Hardhat 节点。

### 1. 钱包准备

- 在 MetaMask 中添加 **Revive Testnet**：
  - 网络名称：Revive Testnet
  - RPC URL：`https://rpc-testnet.revive.global`
  - Chain ID：`637173`
  - 货币符号：`IVE`
  - 区块浏览器：`https://testnet.revive.global`
- 获取 IVE 测试币（通过活动方/群或官方 faucet）。

### 2. 部署合约到 Revive

```bash
cd contracts
# 在 .env 中设置 PRIVATE_KEY（部署账户，需有 IVE）
pnpm run deploy:revive
```

部署完成后会写入 `frontend/.env.local`（合约地址、NEXT_PUBLIC_CHAIN_ID=637173、RPC）。

### 3. 启动前端

```bash
cd frontend
pnpm run dev
```

打开 http://localhost:3000，连接钱包并切换到 Revive Testnet，即可创建任务、认领、提交、验收。

### 4. 功能测试与数据验证（Smoke 脚本）

部署后可用脚本在 Revive 上跑一遍完整流程并输出 tx 与浏览器链接：

```bash
cd contracts
# 需在 .env 中设置 PRIVATE_KEY（发布者）和 PRIVATE_KEY_WORKER（接单者），且两账户均有 IVE
pnpm run smoke:revive
```

脚本会：创建任务 → 认领 → 提交交付物（含真实 deliverableHash）→ 验收发奖，并打印每笔交易的 `https://testnet.revive.global/tx/<hash>`。

## 多环境支持（Revive / 本地 / 测试网 / 主网）

通过 `NEXT_PUBLIC_CHAIN_ID` 指定目标链（默认 637173 = Revive Testnet）：

| 环境 | Chain ID | 说明 |
|------|----------|------|
| Revive 测试网 | 637173 | 默认；需先 `pnpm run deploy:revive`，再启动前端 |
| 本地 | 31337 | Hardhat Local，需先 `npm run node` + `deploy:local` |
| 测试网 | 11155111 | Sepolia；需部署合约并设置 `NEXT_PUBLIC_CONTRACT_ADDRESS` |
| 主网 | 1 | Ethereum Mainnet；需部署合约并设置对应 RPC 与合约地址 |

参考 `frontend/.env.example` 配置不同环境的 `.env.local`。

## 合约架构

### BountyBoard.sol

任务状态机：

```
Created → Claimed → Submitted → Accepted (终态，自动发奖)
  ↓                    ↓ (reject)
Cancelled           ← Claimed (允许重新提交)
  ↓
Expired (超时退款)
```

核心函数：

| 函数 | 说明 |
|------|------|
| `createTask(deadline, metaURI)` | 创建任务并锁仓原生币奖励 |
| `claimTask(taskId)` | 认领任务 |
| `submitWork(taskId, uri, hash)` | 提交交付物 |
| `acceptWork(taskId)` | 验收并自动发奖 |
| `rejectWork(taskId)` | 拒绝，允许重新提交 |
| `cancelTask(taskId)` | 取消未认领的任务，退款 |
| `expireTask(taskId)` | 超时处理，退款给发布者 |

### MVP 设计决策

| 项目 | 决策 |
|------|------|
| 奖励类型 | 仅支持原生币（无 ERC20） |
| 拒绝机制 | 允许重新提交（无争议仲裁） |
| 元数据存储 | MVP 用 JSON 字符串上链；生产环境切 IPFS (Pinata) |
| 配置注入 | RPC / Chain ID / 合约地址通过环境变量注入 |

## 前端技术栈

- **React + Next.js 14** (App Router)
- **wagmi v2 + viem v2** — 钱包连接与合约交互
- **Tailwind CSS** — 深色主题 UI
- **@tanstack/react-query** — 数据缓存与自动刷新

### 页面

| 路由 | 功能 |
|------|------|
| `/` | 任务广场（列表/筛选/分页/KPI） |
| `/create` | 发布任务表单 |
| `/task/[id]` | 任务详情 + 角色操作按钮 |
| `/my-tasks` | 我发布的 / 我认领的任务 |

## 环境变量

### contracts/.env（Revive 部署与 Smoke 必填）

```env
# Revive 部署与 smoke:revive 必填
PRIVATE_KEY=...
PRIVATE_KEY_WORKER=...   # 仅 smoke:revive 需要第二个账户

# 可选
REVIVE_RPC_URL=https://rpc-testnet.revive.global
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
```

### frontend/.env.local（部署脚本自动生成，或参考 .env.example）

**Revive Testnet（默认，由 deploy:revive 写入）：**
```env
NEXT_PUBLIC_CHAIN_ID=637173
NEXT_PUBLIC_RPC_URL=https://rpc-testnet.revive.global
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

**本地 Hardhat**：运行 `deploy:local` 后会写入 31337 与本地 RPC。**测试网 / 主网**：修改 `NEXT_PUBLIC_CHAIN_ID`、RPC 与 `NEXT_PUBLIC_CONTRACT_ADDRESS` 为对应环境。

## 测试

```bash
cd contracts && npm run test
```

覆盖用例（42 条）：

- createTask：正常路径、零奖励、过期截止、空元数据
- claimTask：正常路径、重复认领、过期、创建者自认领
- submitWork：正常路径、非 worker、过期、空交付物
- acceptWork：正常路径、非创建者、重复发奖
- rejectWork：拒绝后重新提交流程
- cancelTask：仅 Created 可取消
- expireTask：不同状态的过期处理、宽限期校验

## Demo / Smoke 脚本

**Revive Testnet（推荐，功能测试与数据验证）：**
```bash
cd contracts
pnpm run deploy:revive   # 先部署
pnpm run smoke:revive   # 全流程 + 输出 explorer 链接
```

**本地 Hardhat：**
```bash
cd contracts
npm run node             # 终端 1
npx hardhat run scripts/demo.ts --network localhost   # 终端 2
```

两者均为完整闭环：创建任务 → 认领 → 提交（含真实 deliverableHash）→ 验收 → 发奖。

## 开发路线

1. ✅ 合约 MVP + 单元测试
2. ✅ 前端 4 个页面打通链上闭环
3. ⬜ 元数据切换 IPFS (Pinata)
4. ⬜ Indexer 提升列表体验（可选）
5. ✅ 部署到 Revive 测试网（deploy:revive + smoke:revive，默认链 637173）

## License

MIT
