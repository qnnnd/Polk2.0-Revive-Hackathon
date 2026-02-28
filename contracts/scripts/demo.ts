import { ethers } from "hardhat";

async function main() {
  const [creator, worker] = await ethers.getSigners();
  const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const board = await ethers.getContractAt("BountyBoard", address);

  console.log("=== Revive Bounty Board Demo ===\n");
  console.log("Creator:", creator.address);
  console.log("Worker:", worker.address);

  // 1. Create task
  const deadline = Math.floor(Date.now() / 1000) + 48 * 3600;
  const meta = JSON.stringify({
    title: "制作产品落地页",
    description: "创建一个响应式落地页，包含3个功能模块",
    tags: ["frontend", "react"],
  });

  console.log("\n--- 1. 创建任务 ---");
  const tx1 = await board
    .connect(creator)
    .createTask(deadline, meta, { value: ethers.parseEther("1.0") });
  await tx1.wait();
  console.log("任务 #0 已创建, 锁仓 1.0 ETH");

  // Create a second task
  const meta2 = JSON.stringify({
    title: "编写 API 文档",
    description: "为所有REST端点编写文档",
    tags: ["docs", "api"],
  });
  const tx1b = await board
    .connect(creator)
    .createTask(deadline, meta2, { value: ethers.parseEther("0.5") });
  await tx1b.wait();
  console.log("任务 #1 已创建, 锁仓 0.5 ETH");

  console.log("Total tasks:", (await board.totalTasks()).toString());

  // 2. Claim task
  console.log("\n--- 2. 认领任务 #0 ---");
  const tx2 = await board.connect(worker).claimTask(0);
  await tx2.wait();
  console.log("Worker 认领了任务 #0");

  // 3. Submit work
  console.log("\n--- 3. 提交交付物 ---");
  const deliverableURI = "https://github.com/example/landing-page";
  const deliverableHash = ethers.keccak256(
    ethers.toUtf8Bytes("landing-page-v1")
  );
  const tx3 = await board
    .connect(worker)
    .submitWork(0, deliverableURI, deliverableHash);
  await tx3.wait();
  console.log("Worker 提交了交付物:", deliverableURI);

  // 4. Accept work
  console.log("\n--- 4. 验收并发奖 ---");
  const balBefore = await ethers.provider.getBalance(worker.address);
  const tx4 = await board.connect(creator).acceptWork(0);
  await tx4.wait();
  const balAfter = await ethers.provider.getBalance(worker.address);
  console.log("Creator 验收通过, 奖励已发放!");
  console.log(
    "Worker 余额变化:",
    ethers.formatEther(balAfter - balBefore),
    "ETH"
  );

  // 5. Check final state
  console.log("\n--- 5. 查看最终状态 ---");
  const task = await board.getTask(0);
  const statusLabels = [
    "Created",
    "Claimed",
    "Submitted",
    "Accepted",
    "Cancelled",
    "Expired",
  ];
  console.log("Task #0 status:", statusLabels[Number(task.status)]);
  console.log("Task #0 worker:", task.worker);

  console.log("\n=== Demo 完成! 全链闭环验证通过 ===");
}

main().catch(console.error);
