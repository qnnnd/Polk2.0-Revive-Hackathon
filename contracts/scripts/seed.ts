import { ethers } from "hardhat";

const TITLES = [
  "制作产品落地页", "编写 API 文档", "设计 Logo",
  "实现智能合约单测", "前端性能优化", "撰写白皮书",
  "UI/UX 用户调研", "搭建 CI/CD 流水线", "编写安全审计报告",
  "集成 IPFS 存储", "实现事件索引器", "多语言国际化",
  "移动端适配", "编写集成测试", "数据库 Schema 设计",
  "接入 Polkadot 钱包", "优化 Gas 消耗", "实现通知系统",
  "编写部署脚本", "创建演示视频",
];

const TAGS_POOL = [
  "frontend", "backend", "solidity", "docs", "design", "devops",
  "security", "test", "ux", "infra", "web3", "polkadot",
];

const DESCRIPTIONS = [
  "请在截止日期前完成交付，提交链接或文档。",
  "需要包含完整的说明文档和示例代码。",
  "交付物需通过代码审查和功能测试。",
  "参考现有文档进行扩展和优化。",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  const signers = await ethers.getSigners();
  const N = parseInt(process.env.SEED_COUNT || "20", 10);

  const boardAddr = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const board = await ethers.getContractAt("BountyBoard", boardAddr);

  console.log(`🌱 Seeding ${N} tasks...\n`);

  for (let i = 0; i < N; i++) {
    const creator = signers[i % 5]; // rotate through first 5 accounts
    const worker = signers[(i % 5) + 5]; // use accounts 5-9 as workers

    const title = TITLES[i % TITLES.length];
    const tags = pickN(TAGS_POOL, 2);
    const desc = pick(DESCRIPTIONS);
    const meta = JSON.stringify({ title, description: desc, tags });

    const reward = ethers.parseEther((0.1 + Math.random() * 2).toFixed(4));
    const hoursFromNow = 24 + Math.floor(Math.random() * 72);
    const deadline = Math.floor(Date.now() / 1000) + hoursFromNow * 3600;

    const tx = await board.connect(creator).createTask(deadline, meta, { value: reward });
    await tx.wait();

    const r = Math.random();

    if (r < 0.35) {
      // 35% chance: just Created (no further action)
    } else if (r < 0.55) {
      // 20% chance: Claimed
      await (await board.connect(worker).claimTask(i)).wait();
    } else if (r < 0.75) {
      // 20% chance: Submitted
      await (await board.connect(worker).claimTask(i)).wait();
      const deliverable = `https://github.com/example/task-${i}-deliverable`;
      const hash = ethers.keccak256(ethers.toUtf8Bytes(deliverable));
      await (await board.connect(worker).submitWork(i, deliverable, hash)).wait();
    } else {
      // 25% chance: Accepted
      await (await board.connect(worker).claimTask(i)).wait();
      const deliverable = `https://github.com/example/task-${i}-final`;
      const hash = ethers.keccak256(ethers.toUtf8Bytes(deliverable));
      await (await board.connect(worker).submitWork(i, deliverable, hash)).wait();
      await (await board.connect(creator).acceptWork(i)).wait();
    }

    const task = await board.getTask(i);
    const statuses = ["Created", "Claimed", "Submitted", "Accepted", "Cancelled", "Expired"];
    console.log(`  #${i} ${title.padEnd(20)} ${ethers.formatEther(reward).padStart(8)} ETH  [${statuses[Number(task.status)]}]`);
  }

  console.log(`\n✅ Seeded ${N} tasks successfully.`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
