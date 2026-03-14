# Polk2.0 Revive BountyBoard —— Cursor 开发方案（以测试网为准）

## 1. 目标
1) 将项目从当前以 Sepolia/Ethereum 为主的配置，切换为 **Revive Chain Testnet**（EVM JSON-RPC）。  
2) 完成：合约部署到测试网、前端连接测试网、全流程冒烟测试（创建任务→领取→提交→验收/拒绝→取消/过期）。  
3) 交付：可复现的部署与测试说明（README/脚本），并在测试网完成一次实际验证。

---

## 2. 测试网网络参数（可直接使用）
### 2.1 Revive Chain Testnet（用于 MetaMask / wagmi / Hardhat 网络配置）
- **RPC (HTTP)**: `https://rpc-testnet.revive.global`  citeturn0search1  
- **Chain ID**: `637173`  citeturn0search1  
- **Symbol**: `IVE`  citeturn0search1  
- **Explorer**: `https://testnet.revive.global`  citeturn0search1  

> 注意：来源提示 “RPC 与 Explorer 录入时需要带 https://”。 citeturn0search1

### 2.2（可选）Polkadot Hub TestNet（如你们最终要对齐官方 Polkadot Hub EVM 端点）
- **EVM JSON-RPC (HTTP)**: `https://services.polkadothub-rpc.com/testnet`  citeturn0search14  
> 本方案主线以 **Revive Chain Testnet** 为准；Polkadot Hub TestNet 仅作为备选对照。

---

## 3. Cursor 需要完成的改造清单（按优先级）
### P0：让 main 分支可在 Revive Testnet 部署与运行
#### 3.1 合约侧（contracts）
1) **Hardhat 网络配置新增 Revive Testnet**
- 在 `contracts/hardhat.config.*` 中新增 network：`reviveTestnet`
  - url = `https://rpc-testnet.revive.global`
  - chainId = `637173`
  - accounts 使用 `.env` 私钥
2) **部署脚本支持 reviveTestnet**
- 复用现有 deploy 脚本逻辑：部署完成后写入前端 `.env.local`（或既有写入逻辑）
- 输出：合约地址、部署 tx hash、区块号
3) **验证合约可在 reviveTestnet 正常执行**
- 重点调用：`createTask/claimTask/submitWork/acceptWork/rejectWork/cancelTask/expireTask`
- 如果测试网 Gas/费用单位或预估有差异：补充 `gasLimit` 或 `maxFeePerGas/maxPriorityFeePerGas` 的兜底参数（仅在必要时）

#### 3.2 前端侧（frontend）
1) **新增 wagmi chain 配置：Revive Testnet**
- 在 `frontend/src/*` 中链配置处新增：
  - chainId = 637173
  - rpcUrls.default.http = [`https://rpc-testnet.revive.global`]
  - blockExplorers.default.url = `https://testnet.revive.global`
  - nativeCurrency = { name: 'IVE', symbol: 'IVE', decimals: 18 }（若你们当前结构需要）
2) **默认连接 Revive Testnet（或明确 UI 提示切换网络）**
- 当用户在错误网络时：给出“切换到 Revive Testnet”的提示与按钮（wagmi 的 `switchNetwork`）
3) **修复 submitWork 的 deliverableHash 占位问题**
- 当前前端对 `deliverableHash` 使用全 0，占位不可验证（见 `frontend/src/app/task/[id]/page.tsx`）。  
- 改为：对 “交付链接/文本” 做 keccak256（viem 提供 hash 工具），再上链。
  - UI 增加输入框：deliverable（URL 或文本）
  - `deliverableHash = keccak256(toBytes(deliverable))`
  - 同时把原文 deliverable 存到前端本地状态即可（本期不要求 IPFS）

---

### P1：测试与可复现（必须产出）
#### 3.3 端到端冒烟测试脚本/清单
1) 在 README 增加 “Revive Testnet 实测步骤”
- 钱包准备：导入私钥、切网络（ChainId 637173）、获取测试币（如官方 faucet 有链接就写；如果没有，写明“通过活动方/群获取 IVE 测试币”）
- 合约部署：`pnpm/yarn` 一键命令
- 前端启动：`pnpm dev`
2) 建议加一个脚本 `contracts/scripts/smoke.ts`
- 部署后直接用 ethers/viem 走一次全流程：
  - A(发布者) createTask -> B(接单者) claimTask -> B submitWork -> A acceptWork
  - 验证余额变化、任务状态变化
- 输出关键日志：taskId、状态、reward、tx hash、explorer 链接（拼接 `https://testnet.revive.global/tx/<hash>`）

---

### P2：性能/体验（可做但不阻塞测试网交付）
#### 3.4 列表性能（不要求 Indexer 也能改善）
- 你们目前可能是“按 totalTasks 全量拉取再过滤/分页”的模式；任务数大时会慢。
- 不引入 IPFS/Indexer 的前提下，先做轻量缓存：
  - 首次加载全量任务 id 列表后缓存到 localStorage
  - 后续只增量拉取新增的 taskId（根据 totalTasks 差值）
  - UI 分页只渲染当前页

---

## 4. 代码改动建议（落到具体文件）
> 下面路径按你们仓库常见结构写，Cursor 以实际项目为准对齐。

### contracts
- `contracts/hardhat.config.ts`（或 `.js`）  
  - 增加 `reviveTestnet` network
  - 读取 `PRIVATE_KEY`
- `contracts/scripts/deploy.ts`  
  - 支持 `--network reviveTestnet`
  - 部署后写入 `frontend/.env.local`（沿用现有逻辑）
- `contracts/scripts/smoke.ts`（新增）  
  - 全流程冒烟
- `.env.example`  
  - 增加 `PRIVATE_KEY=`、`REVIVE_RPC=`（可选）

### frontend
- `frontend/src/lib/wagmi.ts` / `frontend/src/config/chains.ts`（以实际为准）
  - 增加 reviveTestnet chain 定义
- `frontend/.env.local`  
  - `NEXT_PUBLIC_CHAIN_ID=637173`（若你们已有）
  - `NEXT_PUBLIC_CONTRACT_ADDRESS=<deploy写入>`
- `frontend/src/app/task/[id]/page.tsx`
  - 增加 deliverable 输入
  - `deliverableHash` 改为 keccak256

---

## 5. 验收标准（给 Cursor 的 Done 定义）
1) 合约已在 **Revive Testnet** 部署成功，并能在 Explorer 打开部署交易与合约交互交易。  
2) 前端在 Revive Testnet 下：可创建、领取、提交、验收/拒绝、取消/过期（至少验收路径 + 一条异常路径）。  
3) `deliverableHash` 不再是全 0，占位被移除。  
4) README 提供从 0 到 1 的复现步骤（含网络参数与命令）。  

---

## 6. 后续计划（不在本期要求内）
- IPFS：交付物内容/元数据上 IPFS，仅把 CID/Hash 上链。  
- Indexer：用事件（TaskCreated/TaskClaimed/WorkSubmitted/WorkAccepted）做任务列表与个人任务列表的增量索引。  
