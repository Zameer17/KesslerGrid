import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/ui/Navbar';
import SolarSystem from './components/3d/SolarSystem';
import { Globe, Radio, ShieldAlert, Cpu, Database } from 'lucide-react';
import { ethers } from 'ethers';
import { fetchSatellites, fetchConjunctionAlerts, fetchTelemetryLogs } from './services/apiService';
import { getKesslerContract } from './services/web3Service';

export default function App() {
    const [satellites, setSatellites] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [telemetryLogs, setTelemetryLogs] = useState([]);
    const [selectedSat, setSelectedSat] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch live backend data on mount
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

    // --- NEW: Pre-Flight Balance Checker ---
    const ensureSufficientFunds = async (requiredEthAmount) => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balanceWei = await provider.getBalance(address);
        const requiredWei = ethers.parseEther(requiredEthAmount.toString());

        if (balanceWei < requiredWei) {
            alert(
                `🚨 INSUFFICIENT FUNDS 🚨\n\n` +
                `Your wallet (${address.substring(0, 6)}...${address.substring(38)}) has 0 ETH on the local network.\n\n` +
                `To fix this, open a new terminal in your project folder, run:\n` +
                `npx hardhat console --network localhost\n\n` +
                `Then paste this exact command to fund your wallet:\n` +
                `await (await ethers.getSigners())[0].sendTransaction({ to: "${address}", value: ethers.parseEther("10.0") });`
            );
            return false;
        }
        return true;
    };

    const handleRegister = async (satId, stakeEth) => {
        setLoading(true);
        try {
            // 1. Check balance before attempting transaction
            const hasFunds = await ensureSufficientFunds(stakeEth);
            if (!hasFunds) return; // Stop if broke

            // 2. Execute Transaction
            const contract = await getKesslerContract();
            const registrationFee = ethers.parseEther(stakeEth.toString());

            const tx = await contract.registerSatellite(satId, { value: registrationFee });
            await tx.wait();

            alert(`✅ Satellite ${satId} registered & staked on-chain successfully!`);
        } catch (err) {
            console.error("Registration Error:", err);
            // Catch CALL_EXCEPTION reverting (usually means satellite is already registered)
            if (err.code === "CALL_EXCEPTION") {
                alert("Transaction Reverted: This satellite might already be registered on-chain.");
            } else {
                alert("Registration failed. See console.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStakeMore = async (satId, amountEth) => {
        setLoading(true);
        try {
            // 1. Check balance before attempting transaction
            const hasFunds = await ensureSufficientFunds(amountEth);
            if (!hasFunds) return; // Stop if broke

            // 2. Execute Transaction
            const contract = await getKesslerContract();
            const stakeAmount = ethers.parseEther(amountEth.toString());

            const tx = await contract.stake(satId, { value: stakeAmount });
            await tx.wait();

            alert(`✅ Successfully staked additional ${amountEth} ETH for ${satId}!`);
        } catch (err) {
            console.error("Staking Error:", err);
            // Catch CALL_EXCEPTION reverting (usually means staking before registering)
            if (err.code === "CALL_EXCEPTION") {
                alert("Transaction Reverted: You must Register the satellite before you can add more stake.");
            } else {
                alert("Staking failed. See console.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Web3Provider>
            <div className="w-screen h-screen bg-slate-950 overflow-hidden relative font-sans select-none">
                <Navbar />

                {/* 3D Canvas Background */}
                <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing">
                    <Canvas camera={{ position: [0, 35, 90], fov: 45 }}>
                        <ambientLight intensity={0.4} />
                        <Stars radius={300} depth={120} count={10000} factor={6} saturation={0.8} fade speed={1} />
                        <OrbitControls
                            enablePan={true}
                            enableZoom={true}
                            maxDistance={150}
                            minDistance={5}
                            rotateSpeed={0.5}
                            zoomSpeed={0.8}
                        />
                        <SolarSystem />
                    </Canvas>
                </div>

                {/* Top Right System Status */}
                <div className="absolute top-20 right-6 z-10 hidden lg:flex items-center gap-3 bg-slate-900/85 backdrop-blur-xl border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-300 shadow-xl pointer-events-none">
                    <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>System Status: <strong className="text-white">All Orbits Stable</strong></span>
                </div>

                {/* Bottom-Left: Simulation Info Card */}
                <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-3 w-80 pointer-events-none">
                    <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-800 rounded-2xl p-5 text-white shadow-2xl pointer-events-auto">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-cyan-400" />
                                <h3 className="font-bold text-sm tracking-wide">KesslerGrid Simulation</h3>
                            </div>
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono border border-cyan-500/20">LIVE</span>
                        </div>
                        <div className="space-y-2 text-xs text-slate-300">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Celestial Bodies:</span>
                                <span className="font-mono font-semibold text-white">Sun + Planets + Moons</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Orbital Engine:</span>
                                <span className="font-mono font-semibold text-cyan-400">Real-Time Keplerian</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right-Side Overlay: Satellite Fleet, Staking & AI Watchdog Panel */}
                <div className="absolute top-24 right-6 bottom-6 z-10 w-96 flex flex-col gap-4 pointer-events-none overflow-y-auto pr-1">

                    {/* AI Conjunction Stream */}
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 text-white shadow-2xl pointer-events-auto">
                        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-800">
                            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                            <h3 className="font-bold text-xs uppercase tracking-wider text-red-400">AI Conjunction Watchdog</h3>
                        </div>
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                            {alerts.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No collision threats detected by AI engine.</p>
                            ) : (
                                alerts.map((alert, idx) => (
                                    <div key={idx} className="bg-red-950/40 border border-red-900/60 p-2.5 rounded-xl text-xs">
                                        <div className="flex justify-between font-bold text-red-300">
                                            <span>{alert.satA} ⚡ {alert.satB}</span>
                                            <span>{(alert.riskScore * 100).toFixed(0)}% RISK</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Satellite Asset & Staking Fleet */}
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 text-white shadow-2xl pointer-events-auto flex-1">
                        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-800">
                            <Cpu className="w-4 h-4 text-cyan-400" />
                            <h3 className="font-bold text-xs uppercase tracking-wider text-cyan-400">Registered Satellite Fleet</h3>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {satellites.length === 0 ? (
                                <p className="text-xs text-slate-400">No active satellites found in backend database.</p>
                            ) : (
                                satellites.map((sat) => (
                                    <div
                                        key={sat.satId}
                                        onClick={() => setSelectedSat(sat.satId)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSat === sat.satId ? 'border-cyan-500 bg-slate-800/90' : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'}`}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-xs text-cyan-200">{sat.satId}</span>
                                            <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">STAKED</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRegister(sat.satId, 0.05); }}
                                                disabled={loading}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] py-1.5 rounded font-bold transition"
                                            >
                                                Register (0.05 ETH)
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStakeMore(sat.satId, 0.01); }}
                                                disabled={loading}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-[10px] py-1.5 rounded font-bold transition"
                                            >
                                                + 0.01 ETH
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Telemetry Stream Box */}
                        <div className="mt-4 pt-3 border-t border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-[11px] font-semibold text-slate-300">Telemetry: <strong className="font-mono text-white">{selectedSat || 'None'}</strong></span>
                            </div>
                            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 max-h-24 overflow-y-auto space-y-1">
                                {telemetryLogs.length === 0 ? (
                                    <span className="text-slate-500 italic">Select satellite to load vectors...</span>
                                ) : (
                                    telemetryLogs.map((log, idx) => (
                                        <div key={idx} className="border-b border-slate-900 pb-0.5">
                                            X: {log.posX?.toFixed(1)} | Y: {log.posY?.toFixed(1)} | Z: {log.posZ?.toFixed(1)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </Web3Provider>
    );
}