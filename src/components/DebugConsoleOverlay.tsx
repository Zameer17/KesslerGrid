import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Activity,
  Server,
  Database,
  RefreshCw,
  CheckCircle2,
  Layers,
  Code2,
  Clock,
  Cpu,
  FastForward,
  Coins,
  Orbit,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { useSolarStore } from '../store/useSolarStore';
import { web3Service } from '../services/web3';
import { broadcastSatelliteRefresh, broadcastSceneReset } from '../services/syncChannel';

interface StructuredLog {
  id: string;
  raw: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'CRITICAL';
  source: string;
  message: string;
  timestamp: string;
  isJsonOrData: boolean;
}

export function DebugConsoleOverlay() {
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOGS' | 'HARDHAT_SANDBOX'>('LOGS');
  const [isRawStreamExpanded, setIsRawStreamExpanded] = useState(false);

  // Sandbox state
  const [customTimeSec, setCustomTimeSec] = useState<string>('3600');
  const [sandboxStatus, setSandboxStatus] = useState<string>('HARDHAT EVM NODE READY (CHAIN ID: 31337)');
  const [isSandboxBusy, setIsSandboxBusy] = useState<boolean>(false);
  const [currentBlockNum, setCurrentBlockNum] = useState<number>(0);

  // Store data for live status strip
  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const auditLogs = useSolarStore((s) => s.auditLogs);
  const walletAddress = useSolarStore((s) => s.walletAddress);
  const setIsFocusMode = useSolarStore((s) => s.setIsFocusMode);
  const setDemoFocusPair = useSolarStore((s) => s.setDemoFocusPair);
  const setFocusedBody = useSolarStore((s) => s.setFocusedBody);
  const resetDemoState = useSolarStore((s) => s.resetDemoState);
  const markAsDestroyed = useSolarStore((s) => s.markAsDestroyed);

  // Fetch block number on mount and whenever sandbox is open
  useEffect(() => {
    let isMounted = true;
    const fetchBlock = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        const num = await provider.getBlockNumber();
        if (isMounted) setCurrentBlockNum(num);
      } catch {}
    };

    fetchBlock();
    const interval = setInterval(fetchBlock, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const safeFormat = (args: any[]) =>
      args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

    console.log = (...args: any[]) => {
      originalLog(...args);
      const formatted = safeFormat(args);
      setRawLogs((prev) => [...prev.slice(-80), `[LOG] ${formatted}`]);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      const formatted = safeFormat(args);
      setRawLogs((prev) => [...prev.slice(-80), `[ERROR] ${formatted}`]);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      const formatted = safeFormat(args);
      setRawLogs((prev) => [...prev.slice(-80), `[WARN] ${formatted}`]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Sandbox Handlers
  const handleMineBlock = async (count = 1) => {
    try {
      setIsSandboxBusy(true);
      setSandboxStatus(`⏳ Mining ${count} block(s) on local Hardhat EVM...`);
      const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      for (let i = 0; i < count; i++) {
        await provider.send('evm_mine', []);
      }
      const newBlock = await provider.getBlockNumber();
      setCurrentBlockNum(newBlock);
      setSandboxStatus(`✅ Successfully mined ${count} block(s)! Current Head: #${newBlock}`);
    } catch (err: any) {
      setSandboxStatus(`❌ Mining Error: ${err.message || 'Hardhat RPC unreachable'}`);
    } finally {
      setIsSandboxBusy(false);
    }
  };

  const handleTimeTravel = async (seconds: number) => {
    try {
      setIsSandboxBusy(true);
      setSandboxStatus(`⏳ Warping EVM timestamp forward by ${seconds}s...`);
      const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      await provider.send('evm_increaseTime', [seconds]);
      await provider.send('evm_mine', []);
      const newBlock = await provider.getBlockNumber();
      setCurrentBlockNum(newBlock);
      const hours = (seconds / 3600).toFixed(1);
      setSandboxStatus(`⚡ Temporal Warp complete: +${seconds}s (+${hours}h). Block #${newBlock} mined.`);
    } catch (err: any) {
      setSandboxStatus(`❌ Time Travel Error: ${err.message || 'Hardhat RPC unreachable'}`);
    } finally {
      setIsSandboxBusy(false);
    }
  };

  const handleClaimFaucet = async () => {
    if (!walletAddress) {
      setSandboxStatus('⚠️ Please connect MetaMask or select a wallet operator address first.');
      return;
    }
    try {
      setIsSandboxBusy(true);
      setSandboxStatus(`⏳ Requesting 100 Test ETH for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
      const txHash = await web3Service.fundWalletWithTestEth(walletAddress, '100.0');
      setSandboxStatus(`✅ Faucet Transferred 100 Test ETH! Tx: ${txHash.slice(0, 12)}...`);
    } catch (err: any) {
      setSandboxStatus(`❌ Faucet Error: ${err.message}`);
    } finally {
      setIsSandboxBusy(false);
    }
  };

  const handleTriggerScenario = (scenario: 'A' | 'B' | 'C') => {
    if (scenario === 'A') {
      // High-Risk Conjunction Scenario
      setIsFocusMode(true);
      setDemoFocusPair(['norad_44713', 'norad_48274']);
      setFocusedBody('norad_44713');
      setSandboxStatus('🚀 Scenario A Activated: High-Risk Starlink vs Tiangong Conjunction. Tracking isolation mounted.');
    } else if (scenario === 'B') {
      // Mutual Staked Conjunction
      setIsFocusMode(true);
      setDemoFocusPair(['norad_44713', '45431']);
      setFocusedBody('norad_44713');
      setSandboxStatus('🛡️ Scenario B Activated: Mutual Staked Conjunction (Starlink-1007 vs OneWeb-0128). Ready for avoidance burn.');
    } else if (scenario === 'C') {
      // Uninsured Impact Slashing
      markAsDestroyed('norad_48274');
      markAsDestroyed('norad_41917');
      broadcastSatelliteRefresh();
      setSandboxStatus('💥 Scenario C Activated: Uninsured Debris Impact triggered. Penalty exposure accrued on-chain.');
    }
  };

  const handleResetSandbox = () => {
    resetDemoState();
    broadcastSceneReset();
    broadcastSatelliteRefresh();
    setSandboxStatus('🔄 Reset complete: Demo state and telemetry caches restored to baseline.');
  };

  // Parse logs into structured entries for human readability
  const parsedLogs = useMemo<StructuredLog[]>(() => {
    return rawLogs.map((log, index) => {
      let level: StructuredLog['level'] = 'INFO';
      if (log.includes('[ERROR]') || log.includes('UNINSURED') || log.includes('DESTROYED')) {
        level = log.includes('DESTROYED') || log.includes('IMPACT') ? 'CRITICAL' : 'ERROR';
      } else if (log.includes('[WARN]')) {
        level = 'WARN';
      } else if (log.includes('SUCCESS') || log.includes('MUTUAL') || log.includes('AVOIDANCE')) {
        level = 'SUCCESS';
      }

      // Check for source tags like [useBackendSync] or [BroadcastChannel]
      const cleanPrefix = log.replace(/^\[(LOG|ERROR|WARN)\]\s*/, '');
      const sourceMatch = cleanPrefix.match(/^\[([^\]]+)\]/);
      let source = 'SYSTEM';
      let message = cleanPrefix;

      if (sourceMatch) {
        source = sourceMatch[1];
        message = cleanPrefix.substring(sourceMatch[0].length).trim();
      } else if (cleanPrefix.startsWith('===') || cleanPrefix.startsWith('{') || cleanPrefix.startsWith('[')) {
        source = 'TELEMETRY';
      } else if (cleanPrefix.includes('COLLISION') || cleanPrefix.includes('IMPACT')) {
        source = 'STM_ENGINE';
      } else if (cleanPrefix.includes('SMART CONTRACT') || cleanPrefix.includes('LIABILITY')) {
        source = 'LEDGER_WEB3';
      }

      // Check if message is JSON payload
      const isJsonOrData =
        message.trim().startsWith('{') ||
        message.trim().startsWith('[') ||
        message.includes('Raw API response') ||
        message.includes('SYNC DIAGNOSTIC');

      // Generate consistent display time (HH:MM:SS)
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}:${String(now.getSeconds()).padStart(2, '0')}`;

      return {
        id: `diag-${index}-${timeStr}`,
        raw: log,
        level,
        source,
        message,
        timestamp: timeStr,
        isJsonOrData,
      };
    });
  }, [rawLogs]);

  const diagnosticEvents = useMemo(() => {
    return parsedLogs.filter((l) => !l.isJsonOrData);
  }, [parsedLogs]);

  const rawDataPayloads = useMemo(() => {
    return parsedLogs.filter((l) => l.isJsonOrData);
  }, [parsedLogs]);

  return (
    <>
      {/* 1. Bottom Edge Activation Handle */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            background: 'linear-gradient(180deg, rgba(8, 14, 28, 0.98) 0%, rgba(2, 6, 18, 0.99) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderBottom: 'none',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%, 0 6px)',
            padding: '7px 20px',
            color: '#e2e8f0',
            fontFamily: '"Space Mono", "JetBrains Mono", monospace',
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '1.2px',
            cursor: 'pointer',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.7)';
            e.currentTarget.style.color = '#38bdf8';
            e.currentTarget.style.boxShadow = '0 -4px 24px rgba(0, 0, 0, 0.85), 0 0 22px rgba(56, 189, 248, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            e.currentTarget.style.color = '#e2e8f0';
            e.currentTarget.style.boxShadow = '0 -4px 20px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.15)';
          }}
        >
          <Terminal size={13} style={{ color: '#38bdf8' }} />
          <span>SYSTEM DIAGNOSTICS &amp; SANDBOX</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '2px',
              padding: '1px 5px',
              fontSize: '9px',
              color: '#38bdf8',
            }}
          >
            {activeTab === 'LOGS' ? rawLogs.length : `#${currentBlockNum}`}
          </span>
          {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      {/* 2. Bottom Diagnostics & Sandbox Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 95,
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              style={{
                pointerEvents: 'auto',
                width: 'min(1140px, calc(100vw - 60px))',
                height: '410px',
                marginBottom: '34px',
                background: 'linear-gradient(180deg, rgba(6, 10, 22, 0.98) 0%, rgba(2, 6, 16, 0.99) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                borderRadius: '6px',
                boxShadow: '0 -16px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: '"Space Mono", "JetBrains Mono", monospace',
              }}
            >
              {/* Header Instrument Rail */}
              <div
                style={{
                  height: '44px',
                  padding: '0 16px',
                  background: 'rgba(10, 16, 32, 0.95)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '4px',
                      color: '#38bdf8',
                    }}
                  >
                    <Activity size={15} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        letterSpacing: '1.2px',
                        color: '#f8fafc',
                        lineHeight: 1.2,
                      }}
                    >
                      KESSLERGRID DIAGNOSTICS &amp; HARDHAT CONTROL KERNEL
                    </div>
                    <div
                      style={{
                        fontSize: '9px',
                        color: '#64748b',
                        letterSpacing: '0.8px',
                      }}
                    >
                      LOCAL EVM 31337 // RUNTIME TELEMETRY &amp; TESTBENCH
                    </div>
                  </div>
                </div>

                {/* Header Right Badges & Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '3px',
                      fontSize: '9.5px',
                      color: '#34d399',
                      fontWeight: 700,
                      letterSpacing: '0.6px',
                    }}
                  >
                    <CheckCircle2 size={11} />
                    <span>RPC: 31337</span>
                  </div>

                  <div
                    style={{
                      fontSize: '10px',
                      color: '#94a3b8',
                      fontFamily: '"Space Mono", monospace',
                    }}
                  >
                    BLOCK <span style={{ color: '#38bdf8', fontWeight: 700 }}>#{currentBlockNum}</span>
                  </div>

                  <div style={{ height: '16px', width: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />

                  {activeTab === 'LOGS' && (
                    <button
                      onClick={() => setRawLogs([])}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '3px',
                        color: '#94a3b8',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '4px 9px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#f8fafc';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                      }}
                    >
                      <Trash2 size={11} />
                      <span>CLEAR</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '3px',
                      color: '#94a3b8',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '4px 9px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#f8fafc';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                  >
                    <ChevronDown size={13} />
                    <span>MINIMIZE</span>
                  </button>
                </div>
              </div>

              {/* Tab Navigation Strip (All-Caps Monospace Design Language) */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(8, 14, 28, 0.98)',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGS')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    fontFamily: '"Space Mono", monospace',
                    background: activeTab === 'LOGS' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    color: activeTab === 'LOGS' ? '#38bdf8' : '#64748b',
                    border: 'none',
                    borderBottom: activeTab === 'LOGS' ? '2px solid #38bdf8' : '2px solid transparent',
                    boxShadow: activeTab === 'LOGS' ? 'inset 0 -10px 15px -10px rgba(56, 189, 248, 0.25)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Activity size={13} style={{ color: activeTab === 'LOGS' ? '#38bdf8' : '#64748b' }} />
                  <span>[ 01 // SYSTEM LOGS ]</span>
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: activeTab === 'LOGS' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: activeTab === 'LOGS' ? '#38bdf8' : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    {rawLogs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('HARDHAT_SANDBOX')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    fontFamily: '"Space Mono", monospace',
                    background: activeTab === 'HARDHAT_SANDBOX' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: activeTab === 'HARDHAT_SANDBOX' ? '#34d399' : '#64748b',
                    border: 'none',
                    borderBottom: activeTab === 'HARDHAT_SANDBOX' ? '2px solid #10b981' : '2px solid transparent',
                    boxShadow: activeTab === 'HARDHAT_SANDBOX' ? 'inset 0 -10px 15px -10px rgba(16, 185, 129, 0.25)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Cpu size={13} style={{ color: activeTab === 'HARDHAT_SANDBOX' ? '#10b981' : '#64748b' }} />
                  <span>[ 02 // HARDHAT SANDBOX ]</span>
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: activeTab === 'HARDHAT_SANDBOX' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: activeTab === 'HARDHAT_SANDBOX' ? '#34d399' : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    GOD-MODE
                  </span>
                </button>
              </div>

              {/* Status Ribbon (Sub-Header) */}
              <div
                style={{
                  height: '32px',
                  padding: '0 16px',
                  background: 'rgba(4, 8, 18, 0.95)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  userSelect: 'none',
                  flexShrink: 0,
                  fontSize: '10px',
                  color: '#64748b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={11} style={{ color: '#38bdf8' }} />
                  <span>RUNTIME:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>ACTIVE</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={11} style={{ color: '#34d399' }} />
                  <span>BACKEND:</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>CONNECTED</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={11} style={{ color: '#38bdf8' }} />
                  <span>STORE:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                    {backendSatellites.length} REG SATS
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={11} style={{ color: '#34d399' }} />
                  <span>SYNC:</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>BROADCAST CHANNEL READY</span>
                </div>

                {auditLogs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={11} style={{ color: '#f59e0b' }} />
                    <span>AUDIT RECORDS:</span>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{auditLogs.length}</span>
                  </div>
                )}
              </div>

              {/* TAB 01: SYSTEM LOGS CONTENT */}
              {activeTab === 'LOGS' && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    padding: '10px 16px',
                    gap: '8px',
                  }}
                >
                  {/* PRIMARY LAYER: Human-Readable Diagnostic Events */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        letterSpacing: '1px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} style={{ color: '#38bdf8' }} />
                        <span>LATEST DIAGNOSTIC EVENTS ({diagnosticEvents.length})</span>
                      </div>
                    </div>

                    {diagnosticEvents.length === 0 ? (
                      <div
                        style={{
                          color: '#64748b',
                          fontSize: '11px',
                          fontStyle: 'italic',
                          padding: '12px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <Activity size={13} />
                        <span>LISTENING FOR ACTIVE STM COLLISION &amp; RUNTIME TELEMETRY...</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px' }}>
                        {diagnosticEvents.map((evt) => {
                          let railColor = '#38bdf8';
                          let badgeBg = 'rgba(56, 189, 248, 0.12)';
                          let badgeBorder = 'rgba(56, 189, 248, 0.3)';
                          let badgeColor = '#38bdf8';

                          if (evt.level === 'CRITICAL' || evt.level === 'ERROR') {
                            railColor = '#f43f5e';
                            badgeBg = 'rgba(244, 63, 94, 0.15)';
                            badgeBorder = 'rgba(244, 63, 94, 0.35)';
                            badgeColor = '#fb7185';
                          } else if (evt.level === 'WARN') {
                            railColor = '#fbbf24';
                            badgeBg = 'rgba(251, 191, 36, 0.15)';
                            badgeBorder = 'rgba(251, 191, 36, 0.35)';
                            badgeColor = '#fde047';
                          } else if (evt.level === 'SUCCESS') {
                            railColor = '#34d399';
                            badgeBg = 'rgba(52, 211, 153, 0.15)';
                            badgeBorder = 'rgba(52, 211, 153, 0.35)';
                            badgeColor = '#34d399';
                          }

                          return (
                            <div
                              key={evt.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '6px 10px',
                                background: 'rgba(255, 255, 255, 0.015)',
                                borderLeft: `3px solid ${railColor}`,
                                borderRadius: '2px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '2px',
                                    background: badgeBg,
                                    border: `1px solid ${badgeBorder}`,
                                    color: badgeColor,
                                    flexShrink: 0,
                                    marginTop: '1px',
                                  }}
                                >
                                  {evt.level}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#94a3b8',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    marginTop: '1px',
                                  }}
                                >
                                  {evt.source}:
                                </span>

                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: '#f1f5f9',
                                    lineHeight: '1.4',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {evt.message}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '9px',
                                  color: '#64748b',
                                  flexShrink: 0,
                                  marginTop: '2px',
                                }}
                              >
                                <Clock size={10} />
                                <span>{evt.timestamp}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECONDARY LAYER: Collapsible Raw Runtime Stream */}
                  <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px' }}>
                    <div
                      onClick={() => setIsRawStreamExpanded((prev) => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Code2 size={12} style={{ color: '#64748b' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.8px' }}>
                          RAW RUNTIME STREAM &amp; TELEMETRY PAYLOADS ({rawDataPayloads.length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '9px' }}>
                        <span>{isRawStreamExpanded ? 'COLLAPSE' : 'EXPAND'}</span>
                        {isRawStreamExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                    </div>

                    {isRawStreamExpanded && (
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '8px',
                          background: 'rgba(2, 4, 10, 0.85)',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: '3px',
                          maxHeight: '130px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column-reverse',
                          gap: '3px',
                        }}
                      >
                        {rawDataPayloads.length === 0 ? (
                          <div style={{ color: '#475569', fontSize: '10px', fontStyle: 'italic' }}>
                            No low-level raw telemetry packets currently buffered.
                          </div>
                        ) : (
                          rawDataPayloads.map((payload) => (
                            <div
                              key={payload.id}
                              style={{
                                fontSize: '10px',
                                color: '#94a3b8',
                                lineHeight: '1.4',
                                fontFamily: '"Space Mono", monospace',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              <span style={{ color: '#64748b', marginRight: '6px' }}>[{payload.timestamp}]</span>
                              {payload.raw}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 02: HARDHAT SANDBOX CONTENT (Horizontal Form Factor) */}
              {activeTab === 'HARDHAT_SANDBOX' && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    padding: '14px 16px',
                    gap: '12px',
                    background: 'rgba(2, 6, 16, 0.75)',
                  }}
                >
                  {/* Status Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                      <Zap size={14} style={{ color: '#38bdf8' }} />
                      <span style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{sandboxStatus}</span>
                    </div>
                    {isSandboxBusy && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.15)',
                          padding: '2px 8px',
                          borderRadius: '2px',
                          fontWeight: 700,
                        }}
                      >
                        EXECUTING RPC...
                      </span>
                    )}
                  </div>

                  {/* Horizontal 4-Column Controls Layout */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '12px',
                      alignItems: 'stretch',
                    }}
                  >
                    {/* Panel 1: Block Mining & Liquidity */}
                    <div
                      style={{
                        background: 'rgba(10, 16, 32, 0.85)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '4px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>
                        <Cpu size={13} />
                        <span>01 // MINING &amp; LIQUIDITY</span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleMineBlock(1)}
                          disabled={isSandboxBusy}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            color: '#67e8f9',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                            borderRadius: '3px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        >
                          MINE 1 BLK
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMineBlock(10)}
                          disabled={isSandboxBusy}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            color: '#67e8f9',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                            borderRadius: '3px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        >
                          MINE 10 BLKS
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleClaimFaucet}
                        disabled={isSandboxBusy}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          color: '#34d399',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
                        <Coins size={12} />
                        <span>+100 TEST ETH FAUCET</span>
                      </button>
                    </div>

                    {/* Panel 2: Temporal Warp (Time Travel) */}
                    <div
                      style={{
                        background: 'rgba(10, 16, 32, 0.85)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: '4px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#c084fc' }}>
                        <FastForward size={13} />
                        <span>02 // TEMPORAL WARP</span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleTimeTravel(3600)}
                          disabled={isSandboxBusy}
                          style={{
                            flex: 1,
                            padding: '7px 4px',
                            background: 'rgba(168, 85, 247, 0.15)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            color: '#e9d5ff',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                            borderRadius: '3px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        >
                          +1 HOUR
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTimeTravel(86400)}
                          disabled={isSandboxBusy}
                          style={{
                            flex: 1,
                            padding: '7px 4px',
                            background: 'rgba(168, 85, 247, 0.15)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            color: '#e9d5ff',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                            borderRadius: '3px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        >
                          +24 HOURS
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={customTimeSec}
                          onChange={(e) => setCustomTimeSec(e.target.value)}
                          placeholder="Seconds"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            height: '30px',
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            borderRadius: '3px',
                            color: '#f8fafc',
                            padding: '0 6px',
                            fontSize: '10px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleTimeTravel(Number(customTimeSec) || 3600)}
                          disabled={isSandboxBusy}
                          style={{
                            padding: '0 10px',
                            height: '30px',
                            background: 'rgba(168, 85, 247, 0.25)',
                            border: '1px solid rgba(168, 85, 247, 0.5)',
                            color: '#c084fc',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: isSandboxBusy ? 'not-allowed' : 'pointer',
                            borderRadius: '3px',
                            fontFamily: '"Space Mono", monospace',
                          }}
                        >
                          WARP
                        </button>
                      </div>
                    </div>

                    {/* Panel 3: Mission Scenarios */}
                    <div
                      style={{
                        background: 'rgba(10, 16, 32, 0.85)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: '4px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>
                        <Orbit size={13} />
                        <span>03 // SCENARIOS</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTriggerScenario('A')}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderRadius: '3px',
                          textAlign: 'left',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
                        [A] HIGH-RISK CONJUNCTION
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerScenario('B')}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          background: 'rgba(52, 211, 153, 0.12)',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                          color: '#34d399',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderRadius: '3px',
                          textAlign: 'left',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
                        [B] MUTUAL STAKED BURN
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerScenario('C')}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          background: 'rgba(244, 63, 94, 0.12)',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          color: '#fb7185',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderRadius: '3px',
                          textAlign: 'left',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
                        [C] UNINSURED IMPACT
                      </button>
                    </div>

                    {/* Panel 4: EVM Telemetry & Snapshot */}
                    <div
                      style={{
                        background: 'rgba(10, 16, 32, 0.85)',
                        border: '1px solid rgba(52, 211, 153, 0.25)',
                        borderRadius: '4px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#34d399', marginBottom: '6px' }}>
                          <Server size={13} />
                          <span>04 // EVM TELEMETRY</span>
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.5 }}>
                          <div>NODE: <span style={{ color: '#f8fafc' }}>127.0.0.1:8545</span></div>
                          <div>CHAIN ID: <span style={{ color: '#34d399' }}>31337</span></div>
                          <div>CONTRACT: <span style={{ color: '#38bdf8' }}>0x5FbD...aa3</span></div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetSandbox}
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          background: 'rgba(244, 63, 94, 0.15)',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          color: '#fb7185',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontFamily: '"Space Mono", monospace',
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>RESET SANDBOX STATE</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default DebugConsoleOverlay;


