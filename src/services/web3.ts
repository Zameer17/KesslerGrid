import { ethers } from 'ethers';
import contractData from '../../MainBackend/KesslerGrid/shared/KesslerGridCore.json';
import { useSolarStore } from '../store/useSolarStore';
import { NORAD_SATELLITES } from '../data/noradSatellites';

// Blockchain RPC Node (Defaults to local Hardhat, configurable via VITE_RPC_URL for live testnets like Sepolia)
const LOCAL_RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
const HARDHAT_CHAIN_ID_HEX = '0x7a69'; // 31337 in hexadecimal

// Deployed KesslerGridCore Contract Address & ABI
const CONTRACT_ADDRESS = contractData.address;
const CONTRACT_ABI = contractData.abi;

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Helper to resolve all potential candidate key identifiers for a satellite
export function resolveSatelliteKeys(satelliteId: string): string[] {
  const keys: string[] = [];
  if (!satelliteId) return keys;

  const rawId = String(satelliteId).trim();

  // Find NORAD catalog entry
  const foundNorad = NORAD_SATELLITES.find(
    (s) =>
      String(s.noradId) === rawId ||
      s.name.toLowerCase() === rawId.toLowerCase() ||
      s.id.toLowerCase() === rawId.toLowerCase()
  );

  // Find Backend entry
  let foundBackend: any = null;
  try {
    const backendSats = useSolarStore.getState().backendSatellites;
    foundBackend = backendSats.find(
      (s) =>
        String(s.norad_cat_id) === rawId ||
        s.sat_id.toLowerCase() === rawId.toLowerCase() ||
        s.satellite_name.toLowerCase() === rawId.toLowerCase()
    );
  } catch {}

  // Prioritize strictly resolved NORAD ID first
  const noradStr = String(
    (foundNorad && foundNorad.noradId) ||
    (foundBackend && foundBackend.norad_cat_id) ||
    (!isNaN(Number(rawId)) ? rawId : '')
  ).trim();

  if (noradStr && !keys.includes(noradStr)) {
    keys.push(noradStr);
  }

  // Include raw passed ID if different (e.g. custom alphanumeric IDs)
  if (rawId && !keys.includes(rawId)) {
    keys.push(rawId);
  }

  // Fallback string names (sat.name / sat.id) are strictly removed to prevent matching old seed deployment names
  return keys;
}

export const web3Service = {
  /**
   * Ensures MetaMask is connected specifically to the local Hardhat network (Chain ID 31337).
   * Automatically prompts the user to switch or add the network if needed.
   */
  async ensureHardhatNetwork(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ethereum) return false;

    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId === HARDHAT_CHAIN_ID_HEX) {
        return true;
      }

      // Try switching to Hardhat network in MetaMask
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
        });
        return true;
      } catch (switchError: any) {
        // Error code 4902 indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: HARDHAT_CHAIN_ID_HEX,
                chainName: 'Hardhat Local Network',
                rpcUrls: [LOCAL_RPC_URL],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
          return true;
        }
        throw switchError;
      }
    } catch (err: any) {
      console.warn('Network switch warning:', err.message);
      return false;
    }
  },

  async connectWallet(): Promise<{ address: string; balanceEth: string } | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask extension not found! Please install MetaMask to interact on-chain.');
      return null;
    }

    try {
      // Auto-switch to Hardhat network first
      await this.ensureHardhatNetwork();

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      let balanceWei = await provider.getBalance(address);

      // Auto-fund connected wallet with +100 Test ETH if balance is below 1.0 ETH
      if (balanceWei < ethers.parseEther('1.0')) {
        console.log(`💸 Auto-funding address ${address} with 100 Test ETH...`);
        try {
          await this.fundWalletWithTestEth(address, '100.0');
          balanceWei = await provider.getBalance(address);
        } catch (faucetErr) {
          console.warn('Auto-faucet notice:', faucetErr);
        }
      }

      const balanceEth = parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
      return { address, balanceEth };
    } catch (err: any) {
      console.error('Wallet Connection Error:', err.message);
      return null;
    }
  },

  async fetchWalletBalance(address: string): Promise<string> {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balanceWei = await provider.getBalance(address);
        return parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
      }
      const readProvider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
      const balanceWei = await readProvider.getBalance(address);
      return parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
    } catch (err) {
      return '0.0000';
    }
  },

  async getContract(withSigner = false) {
    if (typeof window !== 'undefined' && window.ethereum && withSigner) {
      await this.ensureHardhatNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    const readProvider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
  },

  async registerSatelliteOnChain(satId: string, stakeEth: number) {
    try {
      console.log("🔵 [web3Service.registerSatelliteOnChain] Executing on-chain registration...", { satId, stakeEth });
      await this.ensureHardhatNetwork();
      const contract = await this.getContract(true);
      const valueWei = ethers.parseEther(stakeEth.toString());
      
      const tx = await contract.registerSatellite(satId, { value: valueWei, gasLimit: 300000 });
      console.log("🔵 [web3Service.registerSatelliteOnChain] Transaction submitted. Waiting for confirmation...", tx.hash);
      const receipt = await tx.wait();
      console.log("🔵 [web3Service.registerSatelliteOnChain] Confirmation received! Block:", receipt.blockNumber, "Tx:", receipt.hash);
      return receipt.hash;
    } catch (err: any) {
      console.error('❌ [web3Service.registerSatelliteOnChain] On-Chain Registration Error:', err);
      throw new Error(err.reason || err.message || 'On-chain transaction failed');
    }
  },

  async isRegisteredOnChain(satId: string): Promise<boolean> {
    try {
      const contract = await this.getContract(false);
      const candidates = resolveSatelliteKeys(satId);
      console.log("🔍 [web3Service.isRegisteredOnChain] Evaluating candidates:", candidates, "for satId:", satId);
      for (const key of candidates) {
        try {
          const isReg = await contract.isRegistered(key);
          console.log(`🔍 [web3Service.isRegisteredOnChain] Key "${key}" -> isRegistered: ${isReg}`);
          if (isReg) return true;
        } catch (e: any) {
          console.warn(`🔍 [web3Service.isRegisteredOnChain] Key "${key}" check error:`, e.message);
        }
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  async stakeOnChain(satelliteId: string, stakeEth: number) {
    try {
      console.log("🟣 [web3Service.stakeOnChain] Initiating stake for:", satelliteId, { stakeEth });
      await this.ensureHardhatNetwork();

      const candidates = resolveSatelliteKeys(satelliteId);
      const contractRead = await this.getContract(false);
      console.log("🟣 [web3Service.stakeOnChain] Checking candidates on-chain:", candidates);
      
      let validKey = candidates[0];
      let isReg = false;

      for (const key of candidates) {
        try {
          const regStatus = await contractRead.isRegistered(key);
          console.log(`🟣 [web3Service.stakeOnChain] Candidate "${key}" isRegistered = ${regStatus}`);
          if (regStatus) {
            validKey = key;
            isReg = true;
            break;
          }
        } catch (e: any) {
          console.warn(`🟣 [web3Service.stakeOnChain] Error checking key "${key}":`, e.message);
        }
      }

      console.log(`🟣 [web3Service.stakeOnChain] Final key selection: "${validKey}", isRegistered: ${isReg}`);

      // Staking must NEVER auto-register a satellite.
      // If not registered, fail immediately with a clear error.
      if (!isReg) {
        throw new Error(`SATELLITE NOT REGISTERED: Satellite "${satelliteId}" is not registered on-chain. Please register satellite first before staking.`);
      }

      if (stakeEth <= 0) {
        throw new Error('ERR_ZERO_STAKE: Stake amount must be greater than 0 ETH.');
      }

      const contractWrite = await this.getContract(true);
      const valueWei = ethers.parseEther(stakeEth.toString());

      console.log(`[web3Service] Executing stakeOnChain for resolved key "${validKey}" with value ${stakeEth} ETH`);

      const tx = await contractWrite.stake(validKey, { value: valueWei, gasLimit: 300000 });
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err: any) {
      console.error('On-Chain Staking Error:', err);
      throw new Error(err.reason || err.message || 'Staking transaction failed');
    }
  },

  async executeAvoidanceBurnOnChain(satelliteId: string) {
    try {
      await this.ensureHardhatNetwork();
      const candidates = resolveSatelliteKeys(satelliteId);
      const contractRead = await this.getContract(false);
      
      let validKey = candidates[0];
      for (const key of candidates) {
        try {
          const regStatus = await contractRead.isRegistered(key);
          if (regStatus) {
            validKey = key;
            break;
          }
        } catch {}
      }

      const contract = await this.getContract(true);
      const tx = await contract.executeAvoidanceBurn(validKey, { gasLimit: 300000 });
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err: any) {
      console.error('On-Chain Avoidance Burn Error:', err);
      throw new Error(err.reason || err.message || 'Avoidance burn transaction failed');
    }
  },

  async fundWalletWithTestEth(targetAddress: string, amountEth = '100.0') {
    try {
      const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
      const funder = new ethers.Wallet(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        provider
      );
      const tx = await funder.sendTransaction({
        to: targetAddress,
        value: ethers.parseEther(amountEth),
      });
      await tx.wait();
      return tx.hash;
    } catch (err: any) {
      console.error('Faucet Error:', err);
      throw new Error(err.message || 'Failed to transfer test ETH');
    }
  }
};
