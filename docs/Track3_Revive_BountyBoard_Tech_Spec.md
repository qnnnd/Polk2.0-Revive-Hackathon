# Track3 技术方案：Revive Bounty Board（任务发布/认领/验收/发奖）

> 面向黑客松评委 + 可直接交给 Cursor 开发的实现级方案  
> 目标：在 **Revive/Polkadot 2.0 生态（EVM 兼容路径）** 上交付可交互 Demo：发布任务 → 认领 → 提交 → 验收 → 自动发奖。

---

## 1. 项目概述

### 1.1 一句话
一个链上托管赏金的任务平台：发布者创建任务并锁定奖金（Escrow），接单者认领并提交交付物，发布者验收后合约自动支付奖励；提供最小争议处理与基础信誉统计。

### 1.2 对应 Track3
- **原创 DApp**：从 0 到 1 实现完整业务闭环与演示。
- **生态结合**：基于 Revive/Polkadot Hub 的 EVM 兼容智能合约环境（Solidity + 标准钱包/RPC 工具链），展示链上托管与可验证流程。
- **可演示**：全链上状态机 + 前端交互 +（可选）事件索引服务。

### 1.3 Demo 成功判定（必须）
- [x] 钱包连接（MetaMask）
- [x] 任务发布并锁仓奖励（原生币或 ERC20）
- [x] 任务认领（防多人同时认领）
- [x] 交付物提交（存 URI/Hash）
- [x] 验收通过即自动发奖（Escrow -> worker）
- [x] 列表/详情页可查看状态、时间、参与者

可选加分：争议/仲裁、基础信誉、事件索引分页、里程碑任务。

---

## 2. 总体架构设计

### 2.1 架构图（逻辑）
```
┌───────────────┐        JSON-RPC         ┌─────────────────────────────┐
│   Web Frontend│ <─────────────────────> │   Revive EVM Compatible RPC  │
│  (React/Next) │                         │  (Polkadot Hub / Revive)     │
└───────┬───────┘                         └───────────────┬─────────────┘
        │ wallet (MetaMask)                               │
        │                                                │
        │ calls / reads                                  │ tx / events
        ▼                                                ▼
┌──────────────────────────┐                   ┌──────────────────────────┐
│  Smart Contracts (Sol)   │                   │ Optional Indexer Service │
│  - Escrow + State Machine│<──── events ─────>│ - Listen events -> DB    │
└──────────────────────────┘                   │ - Search/pagination      │
                                               └──────────────┬──────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────┐
                                                    │ DB (Postgres)   │
                                                    └─────────────────┘

交付物存储（可选）：IPFS / Object Storage（仅上链保存 URI/Hash）
```

### 2.2 组件与职责
1) **前端（必须）**
- 任务广场：列表/筛选/分页（可先链上直读，后续可接 Indexer）
- 任务详情：状态、截止、奖励、交付物、操作按钮
- 发布任务：表单 + 上链 create
- 我的任务：我发布/我认领/我提交
- 仲裁面板（可选）：投票/裁决

2) **智能合约（必须）**
- BountyBoard：任务创建、认领、提交、验收、取消/超时、（可选）争议仲裁
- 支付：支持原生币、（可选）ERC20
- 事件：供前端与索引使用

3) **Indexer（可选但推荐）**
- 监听合约事件写入 DB
- 提供 REST API：列表、搜索、分页、用户视图
- 让 Demo 更顺滑（尤其任务多时）

---

## 3. 数据模型与状态机

### 3.1 任务状态（TaskStatus）
- `Created`：已创建，未认领（发布者可取消）
- `Claimed`：已被认领（认领者可提交或放弃；发布者不可取消）
- `Submitted`：已提交交付物（发布者可验收/拒绝）
- `Accepted`：验收通过并已发奖（终态）
- `Cancelled`：未认领前取消并退回押金（终态）
- `Expired`：超时未提交/未验收触发（可定义为终态，资金按规则退回）
- `Disputed`：（可选）拒绝后进入争议（仲裁后转 `Accepted` 或 `Expired/Cancelled`）

### 3.2 Task 结构（Solidity）
建议结构（MVP 版）：
```solidity
struct Task {
  address creator;
  address worker;            // 0x0 if not claimed
  uint256 reward;            // amount in native or ERC20
  address rewardToken;       // address(0) => native token
  uint64  createdAt;
  uint64  deadline;          // claim/submit deadline
  uint64  submitAt;          // when submitted
  TaskStatus status;
  string  metaURI;           // off-chain metadata (IPFS/HTTPS)
  bytes32 deliverableHash;   // optional hash of deliverable
  string  deliverableURI;    // optional URL/IPFS
}
```

### 3.3 MetaURI 内容（链下 JSON）
示例：
```json
{
  "title": "Build a landing page",
  "description": "Create responsive landing page with 3 sections...",
  "requirements": ["Figma link", "Source code link"],
  "tags": ["frontend", "react"],
  "milestones": []
}
```
链上只存 `metaURI`，大文本与附件留链下。

---

## 4. 智能合约技术方案（实现级）

### 4.1 合约清单
- `BountyBoard.sol`（主合约）
- `interfaces/IERC20.sol`（若支持 ERC20）
- `libs/SafeTransfer.sol`（建议：安全转账包装）

### 4.2 关键函数（MVP）
> 所有函数都需严格校验 `status` 与权限；并 emit 事件。

#### 4.2.1 createTask
- 输入：`reward`, `rewardToken`, `deadline`, `metaURI`
- 行为：
  - 若 `rewardToken == address(0)`：要求 `msg.value == reward`
  - 若 ERC20：`transferFrom(creator, contract, reward)`
  - 生成 taskId（自增）
  - 状态 `Created`
- 返回：`taskId`
- 事件：`TaskCreated(taskId, creator, reward, rewardToken, deadline, metaURI)`

#### 4.2.2 claimTask
- 输入：`taskId`
- 前置：`status == Created` 且 `now <= deadline`
- 行为：
  - `worker = msg.sender`
  - `status = Claimed`
- 事件：`TaskClaimed(taskId, worker)`

#### 4.2.3 submitWork
- 输入：`taskId, deliverableURI, deliverableHash`
- 前置：`status == Claimed` 且 `msg.sender == worker` 且 `now <= deadline`
- 行为：
  - 写入交付物
  - `status = Submitted`
  - `submitAt = now`
- 事件：`TaskSubmitted(taskId, worker, deliverableURI, deliverableHash)`

#### 4.2.4 acceptWork（发奖）
- 输入：`taskId`
- 前置：`status == Submitted` 且 `msg.sender == creator`
- 行为：
  - `status = Accepted`
  - 将 escrow 奖励转给 `worker`
- 事件：`TaskAccepted(taskId)` + `RewardPaid(taskId, worker, amount, token)`

#### 4.2.5 rejectWork（可选：进入 Disputed 或允许重新提交）
- 输入：`taskId, reason`
- 方案 A（更简单）：`status = Disputed`，进入仲裁
- 方案 B（更简单但弱）：仍为 `Claimed`，允许 worker 重新提交（需次数限制）

#### 4.2.6 cancelTask（发布者取消）
- 输入：`taskId`
- 前置：`status == Created` 且 `msg.sender == creator`
- 行为：
  - `status = Cancelled`
  - 退回 escrow 到 creator
- 事件：`TaskCancelled(taskId)`

#### 4.2.7 expireTask（任何人触发）
- 输入：`taskId`
- 前置：`status in {Created, Claimed, Submitted}` 且 `now > deadline + gracePeriod`
- 行为（建议规则）：
  - `Created`：退回 creator
  - `Claimed`：退回 creator（或扣少量给 worker；MVP 不做）
  - `Submitted`：若 creator 长时间不处理，可自动 `Accepted` 或退回；建议更保守：退回 creator 并记录“不作为”
- 事件：`TaskExpired(taskId)`

### 4.3 争议仲裁（可选加分，最小实现）
- 配置：`address[] arbitrators`（1 或 3）
- 流程：`rejectWork` -> `Disputed`
- `voteDispute(taskId, decision)`：仲裁者投票
- 达到阈值后执行：
  - `decision=Pay`：转 `Accepted` 并支付 worker
  - `decision=Refund`：转 `Expired/Cancelled` 并退 creator
- 事件：`DisputeOpened`, `DisputeVoted`, `DisputeResolved`

### 4.4 安全与工程约束
- 使用 `ReentrancyGuard` 或 checks-effects-interactions
- 资金转账用安全封装（原生币 `call{value:}`）
- 对 `metaURI/deliverableURI` 做长度上限（防止过大 gas）
- 所有状态变更都 emit event，便于索引与审计
- 关键参数可配置：`gracePeriod`、`maxResubmit`（如果允许重提）

---

## 5. 前端技术方案（实现级）

### 5.1 技术栈
- React + Next.js（推荐）
- 钱包：MetaMask
- 链交互：`viem + wagmi` 或 `ethers`
- UI：任意（shadcn/ui / tailwind）

### 5.2 页面与交互（必须）
1) **Home / Tasks**
- 列表：`Created/Claimed/Submitted/Accepted`
- 筛选：状态、关键词（有 Indexer 才能做强搜索）
- 入口：Create Task

2) **Task Detail**
- 展示：奖励、截止、状态、发布者、认领者、交付物
- 操作按钮（根据角色 + 状态显示）：
  - 发布者：取消/验收/拒绝
  - 认领者：认领/提交/放弃（可选）
  - 任意：触发 expire（可选）

3) **Create Task**
- 表单：title/description/deadline/reward/token
- `metaURI`：先把 JSON 存到 IPFS/后端，再把 URI 上链

4) **My Tasks**
- 我发布的 / 我认领的（链上按事件筛选或 Indexer API）

### 5.3 前端链交互建议
- 读：`getTask(taskId)`、`totalTasks()` 或基于事件索引
- 写：`createTask`、`claimTask`、`submitWork`、`acceptWork`、`cancelTask`
- 交易反馈：pending/success/fail toast + 自动刷新

---

## 6. Indexer（可选）

### 6.1 为什么建议做
- 任务列表分页、搜索、按用户筛选靠链上直读会很慢
- Indexer 可显著提升 Demo 体验与“开发者体验”评分

### 6.2 技术栈
- Node.js + ethers/viem（监听事件）
- Postgres（或 SQLite）
- REST API（Express/Fastify）

### 6.3 事件监听与表结构
监听事件：`TaskCreated/Claimed/Submitted/Accepted/Cancelled/Expired/Dispute...`

DB 表（示例）：
- `tasks(task_id, creator, worker, reward, token, deadline, status, meta_uri, deliverable_uri, tx_hash, updated_at)`
- `users(address, created_count, completed_count, accepted_count, disputed_count, updated_at)`

REST API（示例）：
- `GET /tasks?status=Created&page=1&pageSize=20`
- `GET /tasks/:id`
- `GET /users/:address/tasks`
- `POST /meta`（上传 metadata JSON，返回 uri）

---

## 7. 部署与开发流程（交给 Cursor 的执行步骤）

### 7.1 仓库结构建议
```
repo/
  contracts/         # Hardhat/Foundry
  frontend/          # Next.js
  indexer/           # optional
  docs/              # this md + demo guide
```

### 7.2 开发顺序（强约束，确保 Demo 可交付）
1) 合约 MVP（create/claim/submit/accept/cancel）+ 单元测试
2) 前端 4 个页面打通链上闭环（不依赖 indexer）
3) 加入 meta 存储（IPFS/后端）
4) 可选：Indexer 提升列表体验
5) 可选：Dispute 仲裁与信誉

### 7.3 合约测试用例（最少）
- createTask：原生币/erc20 两条路径（若只做一种，至少 1 条）
- claimTask：重复认领失败、过期失败
- submitWork：非 worker 提交失败、过期失败
- acceptWork：非 creator 验收失败、重复发奖失败
- cancelTask：仅 Created 可取消

---

## 8. 风险清单与规避策略（Track3 交付导向）

### 8.1 技术风险
- **执行环境差异**：若走 PVM/revive 语义差异可能导致不可预期行为  
  规避：本方案以 **EVM 兼容（REVM）** 路径为主，使用 Solidity + 标准工具链。

- **索引与列表性能**：链上直读大量任务体验差  
  规避：最小可用先按 taskId 范围分页；可选加入 Indexer。

- **争议机制复杂**：做大容易拖进度  
  规避：仲裁只做 “1/3 仲裁者投票” 的最小实现，或者不做。

### 8.2 产品风险
- 同质化：纯 bounty board 可能缺乏创新  
  缓解：在展示中强调 “AI 发布任务入口（链下 agent）” 或 “生态贡献（黑客松/Grant 场景）”。  
  注：AI 部分可先做成按钮触发的“模板任务生成”，不影响链上闭环。

---

## 9. 评审展示要点（交付物与演示脚本）

### 9.1 Demo 脚本（建议 3-5 分钟）
1) 发布者连接钱包 → 创建任务（锁仓奖励）
2) 另一个钱包认领 → 提交交付物
3) 发布者验收 → 自动发奖，展示链上交易与余额变化
4) （可选）展示列表/我的任务/信誉统计

### 9.2 交付物清单
- 合约地址 + ABI
- 前端可访问链接（或本地启动指南）
- Demo 视频（可选）
- README：一键部署/运行
- 本技术方案（本文件）

---

## 10. MVP 范围选择（建议默认）

**建议默认（最稳）：**
- 仅支持 **原生币奖励**（rewardToken=0），不做 ERC20
- 不做仲裁（或只做 1 仲裁者裁决）
- 不做 indexer（或最后一天补）
- 交付物仅存 `deliverableURI + deliverableHash`

---

## 11. 关键接口（给 Cursor）

### 11.1 Solidity 合约接口草案（可直接生成 ABI）
- `function createTask(uint64 deadline, string calldata metaURI) external payable returns (uint256 taskId);`
- `function claimTask(uint256 taskId) external;`
- `function submitWork(uint256 taskId, string calldata deliverableURI, bytes32 deliverableHash) external;`
- `function acceptWork(uint256 taskId) external;`
- `function cancelTask(uint256 taskId) external;`
- `function expireTask(uint256 taskId) external;`
- `function getTask(uint256 taskId) external view returns (Task memory);`
- `function totalTasks() external view returns (uint256);`

Events：
- `event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, uint64 deadline, string metaURI);`
- `event TaskClaimed(uint256 indexed taskId, address indexed worker);`
- `event TaskSubmitted(uint256 indexed taskId, address indexed worker, string deliverableURI, bytes32 deliverableHash);`
- `event TaskAccepted(uint256 indexed taskId);`
- `event RewardPaid(uint256 indexed taskId, address indexed worker, uint256 amount);`
- `event TaskCancelled(uint256 indexed taskId);`
- `event TaskExpired(uint256 indexed taskId);`

### 11.2 前端数据流
- 列表：`totalTasks()` -> 分页读取 `getTask(i)`（MVP）；或 `GET /tasks`（有 indexer）
- 详情：`getTask(taskId)` + 拉取 `metaURI` JSON
- 创建：上传 meta JSON -> 得到 metaURI -> 调用 `createTask`（带 msg.value）

---

## 12. TODO（Cursor 任务拆解）

### 合约
- [ ] BountyBoard.sol：状态机、资金托管、事件
- [ ] 单测：happy path + 失败路径
- [ ] 部署脚本：指定 RPC、链 ID、验证步骤

### 前端
- [ ] 钱包连接/网络检测
- [ ] 任务列表（分页）
- [ ] 任务详情（按钮随角色/状态变化）
- [ ] 发布任务表单 + meta 上传（最简后端或 IPFS）
- [ ] 我的任务

### 可选
- [ ] Indexer + API
- [ ] 仲裁模块
- [ ] 信誉统计

---

## 13. 运行/演示指南（占位，开发完成后补）
- `contracts/`：安装依赖 -> 编译 -> 部署 -> 记录合约地址
- `frontend/`：配置合约地址与 RPC -> `pnpm dev`
- （可选）`indexer/`：配置合约地址与 RPC -> 启动监听

