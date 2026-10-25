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

  const sharedDirs = [
    path.join(__dirname, "../../../shared"),
    path.join(__dirname, "../../shared"),
    path.join(__dirname, "../../../MainBackend/shared"),
    path.join(__dirname, "../../../MainBackend/KesslerGrid/shared")
  ];

  const artifact = await hre.artifacts.readArtifact("KesslerGridCore");
  const deploymentData = {
    address: address,
    abi: artifact.abi
  };

  sharedDirs.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, "KesslerGridCore.json"), JSON.stringify(deploymentData, null, 2));
      console.log(`📄 Updated ABI & Address in: ${path.join(dir, "KesslerGridCore.json")}`);
    } catch (e) {
      console.warn(`Could not write to ${dir}:`, e.message);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
