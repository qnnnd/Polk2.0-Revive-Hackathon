# 本地跑 Revive 节点并完成功能测试与数据校验

本流程满足：**本地跑 Revive 节点 → 合约部署 → 本地功能测试 → 不使用虚构数据 → 功能测试后校验链上数据是否正常**。

## 1. 构建 Revive 本地节点与 ETH-RPC

需要从 Polkadot SDK 编译两个二进制：**revive-dev-node**（链节点）和 **eth-rpc**（EVM 兼容 RPC，端口 8545）。

### 1.1 环境

- 已安装 [Rust](https://rust-lang.org/) 及 [Polkadot SDK 依赖](https://docs.polkadot.com/parachains/install-polkadot-sdk/)。

### 1.2 编译

```bash
git clone https://github.com/paritytech/polkadot-sdk.git
cd polkadot-sdk

# 编译约需 30 分钟
cargo build -p revive-dev-node --bin revive-dev-node --release
cargo build -p pallet-revive-eth-rpc --bin eth-rpc --release
```

产物路径：

- 节点：`target/release/revive-dev-node`
- RPC：`target/release/eth-rpc`

## 2. 启动本地 Revive 环境

需要**两个终端**，先起节点，再起 ETH-RPC。

**终端 1 — 启动链节点：**

```bash
cd polkadot-sdk
./target/release/revive-dev-node --dev
```

看到出块日志即可（如 `Imported #1`）。节点会提供 WebSocket RPC（如 `ws://127.0.0.1:9944`）。

**终端 2 — 启动 ETH-RPC 适配器：**

```bash
cd polkadot-sdk
./target/release/eth-rpc --dev
```

看到类似 `Running JSON-RPC server: addr=127.0.0.1:8545` 即表示 EVM 兼容 RPC 已在 **http://127.0.0.1:8545** 就绪。

此时本地 Revive 已跑起，Hardhat / 前端可连 `http://127.0.0.1:8545` 进行部署与调用。

## 3. 配置本仓库

在 `contracts/` 下复制环境变量并填入用于部署和 smoke 的账户（需为 Revive 本地节点预充值账户，或使用节点开发账户）：

```bash
cd contracts
cp .env.example .env
# 编辑 .env：设置 PRIVATE_KEY、PRIVATE_KEY_WORKER（两个账户需有余额）
```

本地 Revive 默认 chainId 为 **1337**。若你的节点返回其他 chainId，在 `.env` 中设置 `REVIVE_LOCAL_CHAIN_ID=<实际 chainId>`。

## 4. 部署合约到本地 Revive

在**第三个终端**：

```bash
cd contracts
npm run deploy:revive-local
```

脚本会把合约地址和 `NEXT_PUBLIC_CHAIN_ID=1337`、`NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545` 写入 `frontend/.env.local`。

## 5. 本地功能测试（前端）

```bash
cd frontend
npm run dev
```

浏览器打开 http://localhost:3000，在钱包中切换到 **Revive Local**（chainId 1337，RPC `http://127.0.0.1:8545`）。  
可进行：创建任务、认领、提交交付物（交付物会做 `keccak256` 上链，无虚构 hash）、验收等。所有数据均为链上真实数据。

## 6. 功能测试后数据校验（Smoke 脚本）

Smoke 脚本会：在本地 Revive 上执行完整流程（创建 → 认领 → 提交 → 验收），并**校验链上数据**，禁止虚构数据。

```bash
cd contracts
npm run smoke:revive-local
```

脚本会：

1. 使用 `frontend/.env.local` 中的合约地址。
2. 用两个账户执行：创建任务 → 认领 → 提交（`deliverableHash = keccak256(deliverable)`，无占位/伪造）→ 验收。
3. **数据校验**（任一失败会报错退出）：
   - 任务状态为 Accepted
   - 链上 `deliverableHash` 与提交的 hash 一致
   - Worker 余额增加量等于任务奖励
   - 链上 `creator` / `worker` 与脚本使用的地址一致

全部通过则输出：`Smoke passed. Revive flow verified, no forged data.`

## 7. 流程小结

| 步骤 | 说明 |
|------|------|
| 1 | 构建 `revive-dev-node` 与 `eth-rpc`（Polkadot SDK） |
| 2 | 终端 1：`revive-dev-node --dev`；终端 2：`eth-rpc --dev`（8545） |
| 3 | `contracts/.env` 配置 `PRIVATE_KEY`、`PRIVATE_KEY_WORKER` |
| 4 | `npm run deploy:revive-local` → 写入 `frontend/.env.local` |
| 5 | `frontend`: `npm run dev`，在 Revive Local 上手动功能测试 |
| 6 | `npm run smoke:revive-local` → 自动流程 + 链上数据校验 |

至此：**本地跑 Revive 节点、合约部署、本地功能测试、无虚构数据、功能测试后数据校验** 均已完成。
