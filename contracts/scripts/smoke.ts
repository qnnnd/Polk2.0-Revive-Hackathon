import { ethers } from "hardhat";

async function main() {
  const [signerA, signerB] = await ethers.getSigners();
  const GRACE_PERIOD = 7 * 24 * 60 * 60;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   BountyBoard E2E Smoke Test             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Deploy fresh contract
  const BountyBoard = await ethers.getContractFactory("BountyBoard");
  const board = await BountyBoard.deploy(GRACE_PERIOD);
  await board.waitForDeployment();
  const addr = await board.getAddress();
  console.log("✓ Contract deployed to:", addr);

  const balA0 = await ethers.provider.getBalance(signerA.address);
  const balB0 = await ethers.provider.getBalance(signerB.address);

  // Step 1: A creates task
  const deadline = Math.floor(Date.now() / 1000) + 48 * 3600;
  const meta = JSON.stringify({ title: "Smoke Test Task", description: "E2E", tags: ["smoke"] });
  const reward = ethers.parseEther("2.0");

  const tx1 = await board.connect(signerA).createTask(deadline, meta, { value: reward });
  const r1 = await tx1.wait();
  console.log(`✓ [1] createTask  tx=${r1!.hash.slice(0, 18)}...  taskId=0`);

  let task = await board.getTask(0);
  assert(Number(task.status) === 0, "Status should be Created (0)");
  assert(task.creator === signerA.address, "Creator mismatch");

  // Step 2: B claims task
  const tx2 = await board.connect(signerB).claimTask(0);
  const r2 = await tx2.wait();
  console.log(`✓ [2] claimTask   tx=${r2!.hash.slice(0, 18)}...`);

  task = await board.getTask(0);
  assert(Number(task.status) === 1, "Status should be Claimed (1)");
  assert(task.worker === signerB.address, "Worker mismatch");

  // Step 3: B submits work with real hash
  const deliverable = "https://github.com/example/deliverable-v1";
  const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes(deliverable));
  const tx3 = await board.connect(signerB).submitWork(0, deliverable, deliverableHash);
  const r3 = await tx3.wait();
  console.log(`✓ [3] submitWork  tx=${r3!.hash.slice(0, 18)}...  hash=${deliverableHash.slice(0, 18)}...`);

  task = await board.getTask(0);
  assert(Number(task.status) === 2, "Status should be Submitted (2)");
  assert(task.deliverableHash === deliverableHash, "Hash mismatch");

  // Step 4: A accepts work
  const tx4 = await board.connect(signerA).acceptWork(0);
  const r4 = await tx4.wait();
  console.log(`✓ [4] acceptWork  tx=${r4!.hash.slice(0, 18)}...`);

  task = await board.getTask(0);
  assert(Number(task.status) === 3, "Status should be Accepted (3)");

  // Verify balance changes
  const balB1 = await ethers.provider.getBalance(signerB.address);
  const bGain = balB1 - balB0;
  console.log(`\n✓ Worker balance change: +${ethers.formatEther(bGain)} ETH (reward minus gas)`);
  assert(bGain > 0n, "Worker should have gained ETH");

  // Step 5: Test reject → resubmit flow
  console.log("\n--- Reject / Resubmit Flow ---");
  const tx5 = await board.connect(signerA).createTask(deadline, meta, { value: ethers.parseEther("0.5") });
  await tx5.wait();
  console.log("✓ [5] Created task #1");

  await (await board.connect(signerB).claimTask(1)).wait();
  console.log("✓ [6] Claimed task #1");

  const h1 = ethers.keccak256(ethers.toUtf8Bytes("attempt-1"));
  await (await board.connect(signerB).submitWork(1, "https://v1.example.com", h1)).wait();
  console.log("✓ [7] Submitted work (attempt 1)");

  await (await board.connect(signerA).rejectWork(1)).wait();
  console.log("✓ [8] Rejected (rejectCount=1, worker can resubmit)");

  task = await board.getTask(1);
  assert(Number(task.status) === 1, "After reject, status should be Claimed");

  const h2 = ethers.keccak256(ethers.toUtf8Bytes("attempt-2"));
  await (await board.connect(signerB).submitWork(1, "https://v2.example.com", h2)).wait();
  console.log("✓ [9] Resubmitted (attempt 2)");

  await (await board.connect(signerA).acceptWork(1)).wait();
  console.log("✓ [10] Accepted resubmission");

  task = await board.getTask(1);
  assert(Number(task.status) === 3, "Final status should be Accepted");

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   ✅ ALL SMOKE TESTS PASSED              ║");
  console.log("╚══════════════════════════════════════════╝");
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Smoke test failed:", e);
  process.exit(1);
});
