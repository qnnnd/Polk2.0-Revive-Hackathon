# Revive Bounty Board

链上托管赏金的任务平台：发布者创建任务并锁定奖金（Escrow），接单者认领并提交交付物，发布者验收后合约自动支付奖励。

> 基于 Revive/Polkadot 2.0 生态（EVM 兼容路径），Solidity + React/Next.js 全栈实现。

## 快速开始（10 分钟内跑起来）

### 环境要求

- **Node.js** ≥ 18 （推荐 v22+）
- **pnpm** ≥ 8 （`npm i -g pnpm`）
- **MetaMask** 浏览器插件（用于前端钱包交互）

### 一键启动

```bash
# 1. 克隆 & 安装
git clone <repo-url> && cd revive-bounty-board
cd contracts && pnpm install && cd ../frontend && pnpm install && cd ..

# 2. 一键启动（Hardhat节点 → 部署合约 → 生成Demo数据 → 启动前端）
make dev
```

或手动分步启动：

```bash
# 终端 1：启动本地链
cd contracts && npx hardhat node

# 终端 2：部署 + 填充数据
cd contracts && npx hardhat run scripts/deploy.ts --network localhost
cd contracts && npx hardhat run scripts/seed.ts --network localhost

# 终端 3：启动前端
cd frontend && pnpm dev
```

打开 **http://localhost:3000** 即可使用。

### MetaMask 配置

| 参数 | 值 |
|------|-----|
| 网络名称 | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| 货币符号 | `ETH` |

导入 Hardhat 测试账户（私钥）：

```
Account #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Account #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

> ⚠️ 仅用于本地开发，切勿在主网使用这些私钥。

### 常见问题

| 问题 | 解决方案 |
|------|---------|
| `pnpm: command not found` | `npm i -g pnpm` |
| MetaMask 报 nonce 错误 | MetaMask 设置 → 高级 → 清除活动和 nonce 数据 |
| 端口 8545 被占用 | 先关闭已有的 Hardhat 节点进程 |
| 前端页面空白 | 确认 `frontend/.env.local` 中合约地址正确 |

---

## 项目结构

```
repo/
  contracts/             # Hardhat — Solidity 智能合约 + 测试 + 脚本
    contracts/BountyBoard.sol
    test/BountyBoard.test.ts    (45 条单元测试)
    scripts/deploy.ts           (部署脚本，自动写入前端 env)
    scripts/smoke.ts            (E2E 冒烟脚本)
    scripts/seed.ts             (Demo 数据生成)
  frontend/              # Next.js 14 — React 前端
    src/config/chains.ts        (多链配置抽象层)
    src/hooks/useEventIndexer.ts (事件驱动数据层)
    src/hooks/useEnsureChain.ts  (网络切换守卫)
  docs/                  # 技术方案文档 + UI 预览原型
  Makefile               # 一键启动
  package.json           # 根 workspace 脚本
```

## 合约架构

### BountyBoard.sol

任务状态机：

```
Created → Claimed → Submitted → Accepted (终态，自动发奖)
  ↓                    ↓ (reject, ≤1次)
Cancelled           ← Claimed (允许重新提交)
                       ↓ (reject 2次)
                     Cancelled (超限自动退款)
```

核心函数：

| 函数 | 说明 |
|------|------|
| `createTask(deadline, metaURI)` | 创建任务并锁仓原生币奖励 |
| `claimTask(taskId)` | 认领任务 |
| `submitWork(taskId, uri, hash)` | 提交交付物 + 真实 keccak256 哈希 |
| `acceptWork(taskId)` | 验收并自动发奖 |
| `rejectWork(taskId)` | 拒绝（允许 1 次重提交，超限自动退款） |
| `cancelTask(taskId)` | 取消未认领的任务，退款 |
| `expireTask(taskId)` | 超时处理，退款给发布者 |

### 安全特性

- `ReentrancyGuard` 防重入攻击
- `validTask` modifier 校验 taskId 边界
- `deliverableHash` 要求非零，确保真实哈希上链
- Checks-Effects-Interactions 模式
- 事件先于外部调用 emit

## 前端技术栈

- **React + Next.js 14** (App Router)
- **wagmi v2 + viem v2** — 钱包连接与合约交互
- **Tailwind CSS** — 深色主题 UI
- **事件驱动索引器** — 替代 O(n) multicall，localStorage 缓存

### 创新特性

| 特性 | 说明 |
|------|------|
| 可验证交付 | deliverableHash = keccak256(content)，前端可校验 |
| 哈希验证面板 | 任务详情页可对比链上哈希与本地计算 |
| 重提交机制 | 拒绝后允许 1 次重新提交，超限自动终止 |
| 事件索引器 | 基于合约事件构建任务列表，增量同步 |
| 多链配置 | 抽象化网络配置，支持一键切换至测试网/主网 |

## 所有命令

```bash
make help          # 查看所有可用命令
make install       # 安装所有依赖
make dev           # 一键启动本地开发环境
make test          # 运行合约单元测试 (45 条)
make smoke         # 运行 E2E 冒烟测试
make seed          # 生成 Demo 数据
make lint          # 前端代码检查
make build         # 生产构建前端
```

## 环境变量

### frontend/.env.local（由 deploy.ts 自动生成）

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

参考 `frontend/.env.example` 了解测试网/主网配置。

## 测试

```bash
cd contracts && pnpm run test   # 45 条单元测试
```

覆盖用例：
- createTask：正常路径、零奖励、过期截止、空元数据
- claimTask：正常路径、重复认领、过期、创建者自认领、**不存在的 taskId**
- submitWork：正常路径、非 worker、过期、空交付物、**零哈希**
- acceptWork：正常路径、非创建者、重复发奖
- rejectWork：**首次拒绝→重提交→第二次拒绝→自动退款**
- cancelTask：仅 Created 可取消
- expireTask：不同状态的过期处理、宽限期校验

## 路线图

- [x] 合约 MVP + 45 条单元测试
- [x] 前端 4 个页面打通链上闭环
- [x] 真实可验证交付哈希（keccak256）
- [x] E2E 冒烟脚本
- [x] 一键本地启动 (`make dev`)
- [x] 事件驱动索引器 + localStorage 缓存
- [x] Demo 数据生成脚本
- [x] 重提交机制 + 超限自动终止
- [x] 多链配置抽象层（生态插槽）
- [ ] 部署到 Revive/Polkadot Hub 测试网
- [ ] 元数据切换 IPFS (Pinata)
- [ ] 外部 Indexer 服务化
- [ ] 合约安全审计
- [ ] 信誉系统 + 统计面板
- [ ] AI 辅助任务生成

## License

MIT
