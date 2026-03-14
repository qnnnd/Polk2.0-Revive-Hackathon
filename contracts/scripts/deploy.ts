import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const isRevive = network.chainId === 637173n;

  const GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 days

  const BountyBoard = await ethers.getContractFactory("BountyBoard");
  const board = await BountyBoard.deploy(GRACE_PERIOD);
  await board.waitForDeployment();

  const address = await board.getAddress();
  console.log("BountyBoard deployed to:", address);
  console.log("Grace period:", GRACE_PERIOD, "seconds (7 days)");
  if (isRevive) {
    const deployTx = board.deploymentTransaction();
    if (deployTx) {
      const receipt = await deployTx.wait();
      if (receipt) {
        console.log("Deploy tx hash:", receipt.hash);
        console.log(
          "Explorer: https://testnet.revive.global/tx/" + receipt.hash
        );
      }
    }
  }

  const envPath = path.resolve(__dirname, "../../frontend/.env.local");
  const envContent = isRevive
    ? [
        `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`,
        `NEXT_PUBLIC_RPC_URL=https://rpc-testnet.revive.global`,
        `NEXT_PUBLIC_CHAIN_ID=637173`,
        "",
      ].join("\n")
    : [
        `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`,
        `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`,
        `NEXT_PUBLIC_CHAIN_ID=31337`,
        "",
      ].join("\n");

  fs.writeFileSync(envPath, envContent);
  console.log("Frontend .env.local written to:", envPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
