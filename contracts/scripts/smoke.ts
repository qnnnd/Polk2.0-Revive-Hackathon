import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const REVIVE_TESTNET_CHAIN_ID = 637173n;
const REVIVE_LOCAL_CHAIN_ID = 1337n;
const EXPLORER_BASE = "https://testnet.revive.global/tx";

function logTx(label: string, hash: string, chainId: bigint) {
  console.log(label, hash);
  if (chainId === REVIVE_TESTNET_CHAIN_ID) {
    console.log("Explorer:", `${EXPLORER_BASE}/${hash}`);
  }
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK ?? "";
  const isTestnet = network.chainId === REVIVE_TESTNET_CHAIN_ID;
  const isLocal =
    networkName === "reviveLocal" || network.chainId === REVIVE_LOCAL_CHAIN_ID;
  if (!isTestnet && !isLocal) {
    throw new Error(
      "Smoke must run on Revive: use --network reviveTestnet or --network reviveLocal (with revive-dev-node + eth-rpc running)."
    );
  }

  const envPath = path.resolve(__dirname, "../../frontend/.env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      "frontend/.env.local not found. Deploy first: pnpm run deploy:revive or deploy:revive-local"
    );
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/NEXT_PUBLIC_CONTRACT_ADDRESS=(.+)/);
  const address = match ? match[1].trim() : "";
  if (!address || address === "0x0") {
    throw new Error(
      "NEXT_PUBLIC_CONTRACT_ADDRESS not set in frontend/.env.local. Deploy first."
    );
  }

  const signers = await ethers.getSigners();
  if (signers.length < 2) {
    throw new Error(
      "Two accounts required. Set PRIVATE_KEY and PRIVATE_KEY_WORKER in contracts/.env (use Revive dev node pre-funded accounts if running locally)."
    );
  }
  const [creator, worker] = signers;

  const board = await ethers.getContractAt("BountyBoard", address);

  const rewardAmount = "0.01";
  const rewardWei = ethers.parseEther(rewardAmount);

  console.log("=== Revive Bounty Board Smoke Test ===\n");
  console.log("Network:", isLocal ? "Revive Local" : "Revive Testnet");
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
    .createTask(deadline, meta, { value: rewardWei });
  const receipt1 = await tx1.wait();
  if (receipt1) logTx("Create tx:", receipt1.hash, network.chainId);
  const taskId = Number(await board.totalTasks()) - 1;
  console.log("Task #" + taskId + " created, reward", rewardAmount);

  console.log("\n--- 2. Claim task ---");
  const tx2 = await board.connect(worker).claimTask(taskId);
  const receipt2 = await tx2.wait();
  if (receipt2) logTx("Claim tx:", receipt2.hash, network.chainId);

  console.log("\n--- 3. Submit work (real deliverableHash, no forged data) ---");
  const deliverableURI = "https://example.com/smoke-deliverable";
  const deliverableHash = ethers.keccak256(
    ethers.toUtf8Bytes(deliverableURI)
  );
  const tx3 = await board
    .connect(worker)
    .submitWork(taskId, deliverableURI, deliverableHash);
  const receipt3 = await tx3.wait();
  if (receipt3) logTx("Submit tx:", receipt3.hash, network.chainId);
  console.log("DeliverableHash:", deliverableHash);

  console.log("\n--- 4. Accept work ---");
  const balBefore = await ethers.provider.getBalance(worker.address);
  const tx4 = await board.connect(creator).acceptWork(taskId);
  const receipt4 = await tx4.wait();
  if (receipt4) logTx("Accept tx:", receipt4.hash, network.chainId);
  const balAfter = await ethers.provider.getBalance(worker.address);
  const balanceDelta = balAfter - balBefore;
  console.log(
    "Worker balance delta:",
    ethers.formatEther(balanceDelta)
  );

  console.log("\n--- 5. Data verification (chain state must match expectations) ---");
  const task = await board.getTask(taskId);
  const statusLabels = [
    "Created",
    "Claimed",
    "Submitted",
    "Accepted",
    "Cancelled",
    "Expired",
  ];
  const status = Number(task.status);
  console.log("Task status:", statusLabels[status]);
  console.log("Task deliverableHash on chain:", task.deliverableHash);

  const ACCEPTED = 3;
  if (status !== ACCEPTED) {
    throw new Error(
      `Data verification failed: expected task status Accepted (3), got ${status}`
    );
  }
  if (task.deliverableHash !== deliverableHash) {
    throw new Error(
      `Data verification failed: on-chain deliverableHash does not match submitted hash (no forged data allowed)`
    );
  }
  if (balanceDelta !== rewardWei) {
    throw new Error(
      `Data verification failed: worker balance delta ${ethers.formatEther(balanceDelta)} != reward ${rewardAmount}`
    );
  }
  if (task.worker.toLowerCase() !== worker.address.toLowerCase()) {
    throw new Error(
      "Data verification failed: task.worker does not match worker address"
    );
  }
  if (task.creator.toLowerCase() !== creator.address.toLowerCase()) {
    throw new Error(
      "Data verification failed: task.creator does not match creator address"
    );
  }

  console.log("All data checks passed: status, deliverableHash, reward, creator, worker.");
  console.log("\n=== Smoke passed. Revive flow verified, no forged data. ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
