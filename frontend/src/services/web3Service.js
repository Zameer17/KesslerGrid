import { ethers } from "ethers";
// Import dynamically from your root shared folder
import KesslerGridContractData from "../../../shared/KesslerGridCore.json";

export const getKesslerContract = async () => {
    if (!window.ethereum) {
        throw new Error("MetaMask is not installed!");
    }

    try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Initialize Ethers v6 provider
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Dynamically load the address and ABI from the JSON
        const contract = new ethers.Contract(
            KesslerGridContractData.address,
            KesslerGridContractData.abi,
            signer
        );

        return contract;
    } catch (error) {
        console.error("Contract Connection Error:", error);
        throw error;
    }
};