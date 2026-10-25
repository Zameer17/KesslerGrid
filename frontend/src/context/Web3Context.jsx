import React, { createContext, useState, useEffect } from 'react';
import { BrowserProvider, ethers } from 'ethers';

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [chainId, setChainId] = useState(null);

    const connectWallet = async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask to use the KesslerGrid Command Center.');
            return;
        }

        try {
            // Ethers v6 initialization
            const browserProvider = new BrowserProvider(window.ethereum);
            await browserProvider.send("eth_requestAccounts", []);

            const signer = await browserProvider.getSigner();
            const userAddress = await signer.getAddress();
            const network = await browserProvider.getNetwork();

            setProvider(browserProvider);
            setAccount(userAddress);
            setChainId(Number(network.chainId));
        } catch (error) {
            console.error("Wallet Connection Failed:", error);
        }
    };

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) setAccount(accounts[0]);
                else setAccount(null);
            });
            window.ethereum.on('chainChanged', (chainHex) => {
                setChainId(Number(chainHex));
                window.location.reload();
            });
        }
    }, []);

    return (
        <Web3Context.Provider value={{ account, provider, chainId, connectWallet }}>
            {children}
        </Web3Context.Provider>
    );
};