import { ethers } from 'ethers';

const RPC_URL = 'http://127.0.0.1:8545';
const HARDHAT_ACCOUNT_0_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
  const recipientAddress = process.argv[2];
  const amountEth = process.argv[3] || '10.0';

  if (!recipientAddress) {
    console.log('=======================================================');
    console.log('❌ Error: Missing recipient wallet address.');
    console.log('Usage: node scripts/fundAccount.js <YOUR_METAMASK_ADDRESS> [AMOUNT]');
    console.log('Example: node scripts/fundAccount.js 0x349B31dAb10b29b2838a16cC0D226EF2a27fdC49 50');
    console.log('=======================================================');
    process.exit(1);
  }

  console.log(`🚀 Connecting to Hardhat RPC at ${RPC_URL}...`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const funder = new ethers.Wallet(HARDHAT_ACCOUNT_0_KEY, provider);

  const initialBalance = await provider.getBalance(recipientAddress);
  console.log(`👤 Recipient: ${recipientAddress}`);
  console.log(`📊 Initial Balance: ${ethers.formatEther(initialBalance)} ETH`);

  console.log(`💸 Transferring ${amountEth} ETH from Hardhat Account #0 (${funder.address})...`);

  const tx = await funder.sendTransaction({
    to: recipientAddress,
    value: ethers.parseEther(amountEth),
  });

  await tx.wait();

  const newBalance = await provider.getBalance(recipientAddress);
  console.log('=======================================================');
  console.log(`✅ SUCCESS! Transferred ${amountEth} ETH`);
  console.log(`🎉 New Balance: ${ethers.formatEther(newBalance)} ETH`);
  console.log(`📜 Tx Hash: ${tx.hash}`);
  console.log('=======================================================');
}

main().catch((err) => {
  console.error('❌ Transfer Error:', err.message || err);
  process.exit(1);
});
