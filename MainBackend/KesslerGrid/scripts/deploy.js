import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🚀 Deploying KesslerGridCore smart contract...");

    const KesslerGridCore = await hre.ethers.getContractFactory("KesslerGridCore");
    const kesslerGridCore = await KesslerGridCore.deploy();

    await kesslerGridCore.waitForDeployment();
    const contractAddress = await kesslerGridCore.getAddress();

    console.log(`✅ KesslerGridCore deployed to: ${contractAddress}`);

    const sharedDir = path.join(process.cwd(), "shared");
    if (!fs.existsSync(sharedDir)) {
        fs.mkdirSync(sharedDir, { recursive: true });
    }

    const artifact = await hre.artifacts.readArtifact("KesslerGridCore");
    const output = {
        address: contractAddress,
        abi: artifact.abi
    };

    fs.writeFileSync(
        path.join(sharedDir, "KesslerGridCore.json"),
        JSON.stringify(output, null, 2)
    );

    console.log("📁 Contract ABI & Address saved successfully to /shared/KesslerGridCore.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});