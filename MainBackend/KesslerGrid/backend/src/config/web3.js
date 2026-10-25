import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Standard Ethers v6 Initialization
const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl);

// Initialize Oracle Signer Wallet for automated slashing
const privateKey = process.env.ORACLE_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const oracleWallet = new Wallet(privateKey, provider);

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
const contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const kesslerContract = new Contract(contractAddress, contractAbi, oracleWallet);

export { provider, oracleWallet, kesslerContract };