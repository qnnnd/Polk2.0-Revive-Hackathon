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

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 8

### 1. 安装依赖

```bash
cd contracts && pnpm install
cd ../frontend && pnpm install
```

### 2. 编译 & 测试合约

```bash
cd contracts
pnpm run compile        # 编译 Solidity
pnpm run test           # 运行 42 条单元测试
```

### 3. 启动本地链 & 部署合约

```bash
# 终端 1：启动 Hardhat 本地节点
cd contracts
pnpm run node

# 终端 2：部署合约（自动写入 frontend/.env.local）
cd contracts
pnpm run deploy:local
```

### 4. 启动前端

```bash
cd frontend
pnpm run dev            # http://localhost:3000
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

### contracts/.env（可选）

```env
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
PRIVATE_KEY=...
```

### frontend/.env.local（部署脚本自动生成）

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

## 测试

```bash
cd contracts && pnpm run test
```

覆盖用例（42 条）：

- createTask：正常路径、零奖励、过期截止、空元数据
- claimTask：正常路径、重复认领、过期、创建者自认领
- submitWork：正常路径、非 worker、过期、空交付物
- acceptWork：正常路径、非创建者、重复发奖
- rejectWork：拒绝后重新提交流程
- cancelTask：仅 Created 可取消
- expireTask：不同状态的过期处理、宽限期校验

## Demo 脚本

```bash
cd contracts
npx hardhat run scripts/demo.ts --network localhost
```

自动执行完整闭环：创建任务 → 认领 → 提交 → 验收 → 发奖。

## 开发路线

1. ✅ 合约 MVP + 单元测试
2. ✅ 前端 4 个页面打通链上闭环
3. ⬜ 元数据切换 IPFS (Pinata)
4. ⬜ Indexer 提升列表体验（可选）
5. ⬜ 部署到 Revive 测试网

## License

MIT
