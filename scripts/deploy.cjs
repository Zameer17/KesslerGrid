const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying KesslerGridCore smart contract to local network...");

  const KesslerGridCore = await hre.ethers.getContractFactory("KesslerGridCore");
  const contract = await KesslerGridCore.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`=======================================================`);
  console.log(`✅ KesslerGridCore Deployed to: ${address}`);
  console.log(`=======================================================`);

  // Pre-seeding disabled to allow live MetaMask registration demonstration without self-healing bypass
  console.log("ℹ️ Clean deployment: on-chain pre-seeding disabled to demonstrate live registration.");

  const sharedDir = path.join(process.cwd(), "shared");
  if (!fs.existsSync(sharedDir)) {
    fs.mkdirSync(sharedDir, { recursive: true });
  }

  const artifact = await hre.artifacts.readArtifact("KesslerGridCore");
  const deploymentData = {
    address: address,
    abi: artifact.abi
  };

  const targetPath = path.join(sharedDir, "KesslerGridCore.json");
  fs.writeFileSync(targetPath, JSON.stringify(deploymentData, null, 2));
  console.log(`📄 Updated ABI & Address in: ${targetPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
