import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Standard Ethers v6 Initialization
const provider = new JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);

// Initialize Oracle Signer Wallet for automated slashing
const oracleWallet = new Wallet(process.env.ORACLE_PRIVATE_KEY, provider);

// Load Contract ABI from shared automated export directory
const abiPath = path.resolve(process.cwd(), '../shared/abis/KesslerGridCore.json');
let contractAbi = [];

try {
    const fileData = fs.readFileSync(abiPath, 'utf8');
    const parsedData = JSON.parse(fileData);
    contractAbi = parsedData.abi || parsedData;
} catch (err) {
    console.warn("⚠️ Warning: KesslerGridCore ABI not found in shared folder. Deploy the smart contract first.");
}

// Connect the smart contract instance
const contractAddress = process.env.CONTRACT_ADDRESS;
const kesslerContract = new Contract(contractAddress, contractAbi, oracleWallet);

export { provider, oracleWallet, kesslerContract };