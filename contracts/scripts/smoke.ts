import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const EXPLORER_BASE = "https://testnet.revive.global/tx";

function logTx(label: string, hash: string) {
  console.log(label, hash);
  console.log("Explorer:", `${EXPLORER_BASE}/${hash}`);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 637173n) {
    throw new Error("Smoke script must run on Revive Testnet (chainId 637173). Use: pnpm run smoke:revive");
  }

  const envPath = path.resolve(__dirname, "../../frontend/.env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      "frontend/.env.local not found. Deploy first: pnpm run deploy:revive"
    );
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/NEXT_PUBLIC_CONTRACT_ADDRESS=(.+)/);
  const address = match ? match[1].trim() : "";
  if (!address || address === "0x0") {
    throw new Error(
      "NEXT_PUBLIC_CONTRACT_ADDRESS not set in frontend/.env.local. Deploy first: pnpm run deploy:revive"
    );
  }

  const signers = await ethers.getSigners();
  if (signers.length < 2) {
    throw new Error(
      "Revive smoke requires two accounts. Set PRIVATE_KEY (creator) and PRIVATE_KEY_WORKER in .env"
    );
  }
  const [creator, worker] = signers;

  const board = await ethers.getContractAt("BountyBoard", address);

  console.log("=== Revive Bounty Board Smoke Test ===\n");
  console.log("Contract:", address);
  console.log("Creator:", creator.address);
  console.log("Worker:", worker.address);

  const deadline = Math.floor(Date.now() / 1000) + 48 * 3600;
  const meta = JSON.stringify({
    title: "Smoke test task",
    description: "Full flow: create -> claim -> submit -> accept",
    tags: ["smoke", "revive"],
  });

  console.log("\n--- 1. Create task ---");
  const tx1 = await board
    .connect(creator)
    .createTask(deadline, meta, { value: ethers.parseEther("0.01") });
  const receipt1 = await tx1.wait();
  if (receipt1) logTx("Create tx:", receipt1.hash);
  const taskId = Number(await board.totalTasks()) - 1;
  console.log("Task #" + taskId + " created, reward 0.01 IVE");

  console.log("\n--- 2. Claim task ---");
  const tx2 = await board.connect(worker).claimTask(taskId);
  const receipt2 = await tx2.wait();
  if (receipt2) logTx("Claim tx:", receipt2.hash);

  console.log("\n--- 3. Submit work (with real deliverableHash) ---");
  const deliverableURI = "https://example.com/smoke-deliverable";
  const deliverableHash = ethers.keccak256(
    ethers.toUtf8Bytes(deliverableURI)
  );
  const tx3 = await board
    .connect(worker)
    .submitWork(taskId, deliverableURI, deliverableHash);
  const receipt3 = await tx3.wait();
  if (receipt3) logTx("Submit tx:", receipt3.hash);
  console.log("DeliverableHash:", deliverableHash);

  console.log("\n--- 4. Accept work ---");
  const balBefore = await ethers.provider.getBalance(worker.address);
  const tx4 = await board.connect(creator).acceptWork(taskId);
  const receipt4 = await tx4.wait();
  if (receipt4) logTx("Accept tx:", receipt4.hash);
  const balAfter = await ethers.provider.getBalance(worker.address);
  console.log(
    "Worker balance delta:",
    ethers.formatEther(balAfter - balBefore),
    "IVE"
  );

  console.log("\n--- 5. Verify state ---");
  const task = await board.getTask(taskId);
  const statusLabels = [
    "Created",
    "Claimed",
    "Submitted",
    "Accepted",
    "Cancelled",
    "Expired",
  ];
  console.log("Task #0 status:", statusLabels[Number(task.status)]);
  console.log("Task #0 deliverableHash:", task.deliverableHash);

  console.log("\n=== Smoke passed. Revive Testnet flow verified. ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
