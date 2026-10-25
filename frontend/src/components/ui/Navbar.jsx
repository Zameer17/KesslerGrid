import React, { useContext } from 'react';
import { Web3Context } from '../../context/Web3Context';
import { Globe2 } from 'lucide-react';

export default function Navbar() {
    const { account, connectWallet } = useContext(Web3Context);

    return (
        <header className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                    <Globe2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-widest text-white">
                        KESSLER<span className="text-cyan-400">GRID</span>
                    </h1>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                        Solar System & LEO Debris Tracking
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/50 px-3.5 py-1.5 rounded-full border border-emerald-500/30 shadow-inner">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Planetary Watchdog Active
                </div>

                <button
                    onClick={connectWallet}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(8,145,178,0.4)] border border-cyan-400/30 cursor-pointer active:scale-95"
                >
                    {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Connect MetaMask'}
                </button>
            </div>
        </header>
    );
}