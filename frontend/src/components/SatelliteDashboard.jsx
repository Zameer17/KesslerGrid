import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { ethers } from "ethers"; // Added Ethers.js for transaction formatting
import { fetchSatellites, fetchConjunctionAlerts, fetchTelemetryLogs } from "../services/apiService";
import { getKesslerContract } from "../services/web3Service"; // Updated to use dynamic contract service

export default function SatelliteDashboard() {
    // State Management
    const [satellites, setSatellites] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [telemetryLogs, setTelemetryLogs] = useState([]);
    const [selectedSat, setSelectedSat] = useState(null);
    const [account, setAccount] = useState("");
    const [loading, setLoading] = useState(false);

    // Three.js Canvas Ref
    const mountRef = useRef(null);

    // 1. Initialize Data Fetching & Three.js 3D Visualization on Mount
    useEffect(() => {
        async function loadBackendData() {
            const liveSatellites = await fetchSatellites();
            const liveAlerts = await fetchConjunctionAlerts();

            if (liveSatellites.length > 0) {
                setSatellites(liveSatellites);
                setSelectedSat(liveSatellites[0].satId);
            }
            setAlerts(liveAlerts);
        }
        loadBackendData();

        // --- Three.js 3D Orbital Scene Setup ---
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        mountRef.current.appendChild(renderer.domElement);

        // Earth Sphere
        const earthGeometry = new THREE.SphereGeometry(2, 32, 32);
        const earthMaterial = new THREE.MeshBasicMaterial({ color: 0x1d4ed8, wireframe: true });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        scene.add(earth);

        // Satellite Orbit Rings / Markers
        const orbitGroup = new THREE.Group();
        scene.add(orbitGroup);

        const satGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const satMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const satelliteMesh = new THREE.Mesh(satGeometry, satMaterial);
        satelliteMesh.position.set(3, 1, 0);
        orbitGroup.add(satelliteMesh);

        camera.position.z = 6;

        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            earth.rotation.y += 0.002;
            orbitGroup.rotation.y += 0.005;
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup on unmount
        return () => {
            cancelAnimationFrame(animationFrameId);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    // Fetch telemetry logs when selected satellite changes
    useEffect(() => {
        if (!selectedSat) return;
        async function getTelemetry() {
            const logs = await fetchTelemetryLogs(selectedSat);
            setTelemetryLogs(logs);
        }
        getTelemetry();
    }, [selectedSat]);

    // 2. MetaMask Wallet Connection Handler
    const handleConnect = async () => {
        if (!window.ethereum) {
            alert("MetaMask is not installed. Please install it to use this app.");
            return;
        }
        try {
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            if (accounts.length > 0) {
                setAccount(accounts[0]);
            }
        } catch (err) {
            console.error("Wallet connection failed:", err);
        }
    };

    // 3. On-Chain Satellite Registration & Staking Handler
    const handleRegister = async (satId, stakeEth) => {
        setLoading(true);
        try {
            const contract = await getKesslerContract();
            // Convert the ETH amount to Wei
            const registrationFee = ethers.parseEther(stakeEth.toString());

            // Execute smart contract transaction
            const tx = await contract.registerSatellite(satId, { value: registrationFee });
            await tx.wait(); // Wait for block confirmation

            alert(`Satellite ${satId} registered and staked on-chain successfully!`);
        } catch (err) {
            console.error("Registration Error:", err);
            alert("Registration transaction failed. Check browser console for details.");
        } finally {
            setLoading(false);
        }
    };

    const handleStakeMore = async (satId, amountEth) => {
        setLoading(true);
        try {
            const contract = await getKesslerContract();
            // Convert the ETH amount to Wei
            const stakeAmount = ethers.parseEther(amountEth.toString());

            // Execute smart contract transaction
            const tx = await contract.stake(satId, { value: stakeAmount });
            await tx.wait(); // Wait for block confirmation

            alert(`Successfully staked additional ${amountEth} ETH for ${satId}!`);
        } catch (err) {
            console.error("Staking Error:", err);
            alert("Staking transaction failed. Check browser console for details.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container p-6 bg-slate-950 text-white min-h-screen font-sans">
            {/* Header & Wallet Status Bar */}
            <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                <div>
                    <h1 className="text-2xl font-black tracking-wider text-cyan-400">KESSLERGRID // ORBITAL COMMAND</h1>
                    <p className="text-xs text-slate-400">Decentralized Satellite Telemetry & Conjunction Governance</p>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded font-mono text-emerald-400">
                        NETWORK: Hardhat Local [Chain ID: 31337]
                    </span>
                    <button
                        onClick={handleConnect}
                        className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded font-mono text-sm font-bold transition-all shadow-lg shadow-cyan-900/50"
                    >
                        {account ? `Connected: ${account.substring(0, 6)}...${account.substring(38)}` : "Connect MetaMask"}
                    </button>
                </div>
            </header>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Column 1 & 2: 3D Visualization + Satellite Management Panel */}
                <div className="lg:col-span-2 space-y-6">

                    {/* 3D Interactive Orbital Visualization (Three.js Canvas) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 relative overflow-hidden shadow-xl">
                        <h2 className="text-sm font-semibold mb-2 text-slate-300 uppercase tracking-widest flex items-center">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping mr-2"></span>
                            Live Orbital Grid Visualization
                        </h2>
                        <div ref={mountRef} className="w-full h-80 rounded bg-slate-950 border border-slate-800/80" />
                    </div>

                    {/* Satellite Asset & Staking Management Panel */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
                        <h2 className="text-sm font-semibold mb-3 text-cyan-400 uppercase tracking-widest">Registered Satellite Fleet & Staking</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {satellites.length === 0 ? (
                                <p className="text-slate-400 text-sm">No live satellites found in database. Standby mode active.</p>
                            ) : (
                                satellites.map((sat) => (
                                    <div
                                        key={sat.satId}
                                        onClick={() => setSelectedSat(sat.satId)}
                                        className={`p-3 rounded border cursor-pointer transition-all ${selectedSat === sat.satId ? 'border-cyan-500 bg-slate-800/80' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-cyan-200">{sat.satId}</p>
                                                <p className="text-xs text-slate-400">Status: {sat.status || "Active Grid"}</p>
                                            </div>
                                            <span className="text-xs font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                                                STAKED
                                            </span>
                                        </div>
                                        <div className="flex space-x-2 mt-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRegister(sat.satId, 0.05); }}
                                                disabled={loading}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs py-1.5 rounded font-bold transition"
                                            >
                                                Register (0.05 ETH)
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStakeMore(sat.satId, 0.01); }}
                                                disabled={loading}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded font-bold transition"
                                            >
                                                + Stake 0.01 ETH
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: AI Watchdog Alerts & Telemetry Metrics Stream */}
                <div className="space-y-6">

                    {/* AI Watchdog & Conjunction Alert Stream */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
                        <h2 className="text-sm font-semibold mb-3 text-red-400 uppercase tracking-widest flex items-center">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>
                            AI Watchdog Conjunction Stream
                        </h2>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {alerts.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">All orbital paths clear. Zero collision warnings detected by AI engine.</p>
                            ) : (
                                alerts.map((alert, idx) => (
                                    <div key={idx} className="bg-red-950/30 border border-red-900/50 p-3 rounded text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-red-300">{alert.satA} ⚡ {alert.satB}</span>
                                            <span className="text-xs font-mono text-red-400 font-bold">{(alert.riskScore * 100).toFixed(0)}% RISK</span>
                                        </div>
                                        <p className="text-xs text-slate-400">Automated slash penalty queued on-chain.</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Live Telemetry & Risk Metrics */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
                        <h2 className="text-sm font-semibold mb-3 text-cyan-400 uppercase tracking-widest">
                            Telemetry Stream: <span className="text-white font-mono">{selectedSat || "None Selected"}</span>
                        </h2>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs space-y-2 max-h-56 overflow-y-auto">
                            {telemetryLogs.length === 0 ? (
                                <p className="text-slate-500 italic">Select a satellite to inspect spatial vectors...</p>
                            ) : (
                                telemetryLogs.map((log, idx) => (
                                    <div key={idx} className="border-b border-slate-900 pb-1 text-slate-300">
                                        <p className="text-cyan-400">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</p>
                                        <p>X: {log.posX?.toFixed(2)} | Y: {log.posY?.toFixed(2)} | Z: {log.posZ?.toFixed(2)}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}