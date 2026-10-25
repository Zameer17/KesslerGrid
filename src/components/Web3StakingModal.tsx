import { useState, useMemo, useEffect } from 'react';
import { useSolarStore } from '../store/useSolarStore';
import { web3Service } from '../services/web3';
import { api, BackendSatellite } from '../services/api';
import { broadcastSatelliteRefresh, broadcastTxStarted, broadcastTxFinished, kesslerSyncChannel } from '../services/syncChannel';
import { NORAD_SATELLITES } from '../data/noradSatellites';
import { MetaMaskFoxIcon } from './MetaMaskFoxIcon';
import {
  ShieldCheck,
  Radio,
  Terminal,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Skull,
  Coins,
  X,
  Activity,
} from 'lucide-react';

export function Web3StakingModal() {
  const showWeb3Modal = useSolarStore((s) => s.showWeb3Modal);
  const setShowWeb3Modal = useSolarStore((s) => s.setShowWeb3Modal);
  const showAuditModal = useSolarStore((s) => s.showAuditModal);
  const setShowAuditModal = useSolarStore((s) => s.setShowAuditModal);

  const walletAddress = useSolarStore((s) => s.walletAddress);
  const walletBalanceEth = useSolarStore((s) => s.walletBalanceEth);
  const isWeb3Connected = useSolarStore((s) => s.isWeb3Connected);
  const setWalletState = useSolarStore((s) => s.setWalletState);

  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const auditLogs = useSolarStore((s) => s.auditLogs);
  const clearAuditLogs = useSolarStore((s) => s.clearAuditLogs);
  const addAuditLog = useSolarStore((s) => s.addAuditLog);

  const [activeTab, setActiveTab] = useState<'staking' | 'register' | 'logs'>(
    showAuditModal ? 'logs' : 'staking'
  );

  // Staking Form State
  const [selectedSatId, setSelectedSatId] = useState(NORAD_SATELLITES[0].noradId.toString());
  const [stakeAmountEth, setStakeAmountEth] = useState('2.5');
  const isSubmitting = useSolarStore((s) => s.isGlobalTxPending);
  const isGlobalTxPending = useSolarStore((s) => s.isGlobalTxPending);
  const setIsGlobalTxPending = useSolarStore((s) => s.setIsGlobalTxPending);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Register Form State
  const [regSatId, setRegSatId] = useState('SAT-ORBITAL-X');
  const [regNoradId, setRegNoradId] = useState('60124');
  const [regName, setRegName] = useState('SENTINEL-X RECON');
  const [regStakeEth, setRegStakeEth] = useState('2.5');
  const [regPenaltyEth, setRegPenaltyEth] = useState('5.0');

  // Deduplicated Fleet: Combines static NORAD catalog with dynamic backend registered fleet
  const allAvailableSatellites = useMemo(() => {
    const map = new Map<string, any>();
    NORAD_SATELLITES.forEach((sat) => {
      map.set(sat.name, sat);
    });
    (backendSatellites || []).forEach((b) => {
      const key = b.satellite_name || b.sat_id;
      if (!map.has(key)) {
        map.set(key, {
          id: b.sat_id,
          name: b.satellite_name || b.sat_id,
          noradId: b.norad_cat_id || 0,
          category: 'Active Fleet',
          categoryId: 'active_fleet',
          modelType: 'cubesat',
        });
      }
    });
    return Array.from(map.values());
  }, [backendSatellites]);

  const uniqueNoradSatellites = allAvailableSatellites;

  // Centralized status resolver from useSolarStore
  const getSatelliteStatus = useSolarStore((s) => s.getSatelliteStatus);

  // Active Registered Fleet & Destroyed Fleet Separation
  const activeRegisteredFleet = useMemo(() => {
    return backendSatellites.filter(
      (sat) => sat.operational_status !== 'DESTROYED' && sat.operator_address && sat.operator_address !== 'UNREGISTERED'
    );
  }, [backendSatellites]);

  const destroyedFleet = useMemo(() => {
    return backendSatellites.filter(
      (sat) => sat.operational_status === 'DESTROYED'
    );
  }, [backendSatellites]);

  // Selected Satellite Status in Staking Tab
  const currentStakingSat = useMemo(() => {
    const found = allAvailableSatellites.find(
      (s) => (s.noradId && String(s.noradId) === String(selectedSatId)) || s.id === selectedSatId || s.name === selectedSatId
    );
    if (found) return found;
    if (selectedSatId) {
      return {
        id: selectedSatId,
        name: selectedSatId,
        noradId: parseInt(selectedSatId, 10) || 0,
        category: 'Active Asset',
        categoryId: 'active',
        modelType: 'cubesat',
      };
    }
    return allAvailableSatellites[0] || null;
  }, [allAvailableSatellites, selectedSatId]);

  const isCurrentStakingDestroyed = currentStakingSat
    ? getSatelliteStatus(currentStakingSat) === 'DESTROYED'
    : false;

  const currentStakingStatus = currentStakingSat
    ? getSatelliteStatus(currentStakingSat)
    : 'UNREGISTERED';

  const isStakeDisabled = isSubmitting || currentStakingStatus !== 'REGISTERED';

  // Selected Satellite Status in Register Tab
  const currentRegSat = useMemo(() => {
    const targetName = (regName || regSatId || '').trim();
    const targetNorad = (regNoradId || '').trim();

    const found = allAvailableSatellites.find(
      (s) =>
        (targetName && s.name && s.name.toLowerCase() === targetName.toLowerCase()) ||
        (targetName && s.id && s.id.toLowerCase() === targetName.toLowerCase()) ||
        (targetNorad && targetNorad !== '0' && String(s.noradId) === targetNorad)
    );
    if (found) return found;

    if (targetName) {
      return {
        id: (regSatId || regName).trim(),
        name: targetName,
        noradId: parseInt(targetNorad, 10) || 0,
        category: 'Custom Sat',
        categoryId: 'custom',
        modelType: 'cubesat',
      };
    }
    return allAvailableSatellites[0] || null;
  }, [regName, regSatId, regNoradId, allAvailableSatellites]);

  const isCurrentRegDestroyed = currentRegSat
    ? getSatelliteStatus(currentRegSat) === 'DESTROYED'
    : false;

  const isCurrentRegRegistered = currentRegSat
    ? getSatelliteStatus(currentRegSat) === 'REGISTERED'
    : false;

  // Cross-tab and inter-component instantaneous synchronization listener
  useEffect(() => {
    const channel = kesslerSyncChannel;
    if (!channel) return;
    const handleBroadcast = async (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_SATELLITES') {
        const fresh = await api.fetchSatellites();
        if (fresh?.length) {
          useSolarStore.getState().setBackendSatellites(fresh);
        }
      }
    };
    channel.addEventListener('message', handleBroadcast);
    return () => {
      channel.removeEventListener('message', handleBroadcast);
    };
  }, []);

  if (!showWeb3Modal && !showAuditModal) return null;

  const handleClose = () => {
    setShowWeb3Modal(false);
    setShowAuditModal(false);
  };

  const handleConnectWallet = async () => {
    const res = await web3Service.connectWallet();
    if (res) {
      setWalletState(res);
      setStatusMessage(`✅ Connected MetaMask wallet: ${res.address.slice(0, 6)}...${res.address.slice(-4)}`);
    }
  };

  const handleExecuteStake = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    console.log("🚨 [BUTTON CLICKED] Register/Stake button triggered! Modal: handleExecuteStake", {
      selectedSatId,
      stakeAmountEth,
      isSubmitting,
      isGlobalTxPending,
      isCurrentStakingDestroyed,
    });
    console.log("🟣 [STAKE: START] Selected dropdown ID: ", selectedSatId, { stakeAmountEth });

    if (isCurrentStakingDestroyed) {
      console.warn("🟣 [STAKE: BLOCKED] Staking disabled for destroyed assets.");
      setStatusMessage('⚠️ ASSET OFFLINE: Telemetry signal lost. Smart contract interactions and staking are disabled for destroyed assets.');
      return;
    }

    const selectedSat = uniqueNoradSatellites.find(
      (s) => String(s.noradId) === String(selectedSatId) || s.id === selectedSatId || s.name === selectedSatId
    ) || { noradId: selectedSatId, norad_cat_id: selectedSatId, id: selectedSatId, name: selectedSatId };

    // Strictly enforce NORAD ID as the on-chain mapping key
    const canonicalId = String(selectedSat.noradId || selectedSat.norad_cat_id || selectedSat.id).trim();
    const displaySatName = selectedSat?.name || selectedSat?.id || canonicalId;

    console.log("🟣 [STAKE: ID RESOLVED] Canonical ID evaluated as: ", canonicalId, {
      selectedSatId,
      selectedSat,
    });
    const globalState = useSolarStore.getState().backendSatellites;
    const trueGlobalSat = globalState.find(
      s => String(s.norad_cat_id) === canonicalId ||
           s.sat_id === canonicalId ||
           s.satellite_name === canonicalId ||
           (selectedSat && (s.sat_id === selectedSat.name || s.satellite_name === selectedSat.name || String(s.norad_cat_id) === String(selectedSat.noradId)))
    );
    console.log("🟣 [STAKE: STORE STATE] True Global Store State:", trueGlobalSat);

    if (!isWeb3Connected) {
      console.warn("🟣 [STAKE: BLOCKED] Wallet not connected.");
      setStatusMessage('⚠️ Please connect your MetaMask wallet first!');
      return;
    }

    setIsGlobalTxPending(true);
    broadcastTxStarted();
    setStatusMessage('⏳ Verifying on-chain registration status...');

    try {
      const isCorrectNet = await web3Service.ensureHardhatNetwork();
      if (!isCorrectNet) {
        setStatusMessage('⚠️ Please switch your MetaMask network to Hardhat Localhost (Chain ID 31337).');
        return;
      }

      // Hard pre-transaction guard clause
      const currentStatus = useSolarStore.getState().getSatelliteStatus(selectedSat);
      if (currentStatus !== 'REGISTERED') {
        throw new Error("UI Validation Failed: Satellite is not registered in the database. Cannot deploy collateral.");
      }

      console.log("🟣 [STAKE: WEB3] Sending Stake to Smart Contract...", { canonicalId, stakeAmountEth });
      const txHash = await web3Service.stakeOnChain(canonicalId, parseFloat(stakeAmountEth));
      console.log("🟣 [STAKE: WEB3 SUCCESS] Tx Hash: ", txHash);
      console.log("🚀 [PIPELINE STEP 1: TX SUCCESS]", {
        action: 'STAKE',
        txHash,
        canonicalId,
        displaySatName,
        amount: stakeAmountEth
      });

      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);

      // Sync additional stake to backend SQLite database
      try {
        const noradNum = parseInt(canonicalId, 10) || selectedSat.noradId || selectedSat.norad_cat_id || 0;
        const operator = walletAddress || updatedWallet?.address || 'UNREGISTERED';
        await api.registerSatellite({
          satId: canonicalId,
          noradId: noradNum,
          satelliteName: displaySatName,
          operatorAddress: operator,
          stakedEth: parseFloat(stakeAmountEth),
          liabilityPenaltyEth: parseFloat(stakeAmountEth) * 2.0,
        });
      } catch (syncErr: any) {
        console.warn('Backend stake sync note:', syncErr.message);
      }

      // Instant optimistic reactive state update for collateral
      const currentFleet = useSolarStore.getState().backendSatellites;
      const targetIdentifier = canonicalId.toLowerCase();
      const updatedFleet = currentFleet.map((s) => {
        if (
          s.sat_id.toLowerCase() === targetIdentifier ||
          s.satellite_name.toLowerCase() === targetIdentifier ||
          (s.norad_cat_id && String(s.norad_cat_id) === targetIdentifier) ||
          (selectedSat.name && s.satellite_name.toLowerCase() === selectedSat.name.toLowerCase())
        ) {
          return {
            ...s,
            staked_amount_eth: (Number(s.staked_amount_eth) || 0) + parseFloat(stakeAmountEth),
          };
        }
        return s;
      });
      useSolarStore.getState().setBackendSatellites(updatedFleet);

      // Background authoritative fetch
      api.fetchSatellites().then((fresh) => {
        if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
      });

      broadcastSatelliteRefresh();

      addAuditLog(`💰 STAKE UPDATE: Added ${stakeAmountEth} ETH collateral to Satellite ${displaySatName} (NORAD #${canonicalId}).`);
      const txPayload = {
        timestamp: new Date().toISOString(),
        actionType: 'STAKE DEPLOYED',
        satelliteName: displaySatName,
        noradId: canonicalId,
        valueEth: `${parseFloat(stakeAmountEth).toFixed(2)} ETH`,
        txHash: txHash,
      };
      console.log("📦 [PIPELINE STEP 2: DISPATCHING TO STORE]", txPayload);
      useSolarStore.getState().addWeb3Transaction(txPayload);
      setStatusMessage(`🎉 On-chain stake confirmed for ${displaySatName}! Tx Hash: ${txHash.slice(0, 14)}...`);
    } catch (err: any) {
      console.error("❌ [STAKE: ERROR] Smart Contract rejected the stake: ", err.message, err);
      // Check if user rejected the transaction in MetaMask
      if (
        err?.code === 4001 ||
        err?.code === 'ACTION_REJECTED' ||
        err?.message?.toLowerCase().includes("user rejected") ||
        err?.info?.error?.code === 4001
      ) {
        useSolarStore.getState().addWeb3Transaction({
          type: 'REJECT',
          satName: displaySatName,
          noradId: canonicalId,
          amount: 0,
          txHash: 'USER_ABORTED',
          timestamp: Date.now(),
          actionType: 'TRANSACTION REJECTED',
          satelliteName: displaySatName,
          valueEth: 'ABORTED',
        });
        setStatusMessage(`⚠️ Transaction cancelled by user in MetaMask.`);
      } else {
        let msg = err.reason || err.message || 'Transaction failed or rejected';
        if (msg.includes('ERR_NOT_REGISTERED') || msg.includes('not registered') || msg.includes('execution reverted')) {
          msg = '❌ Satellite not registered on-chain.';
        }
        setStatusMessage(`⛔ ${msg}`);
      }
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleRegisterSatellite = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    console.log("🚨 [BUTTON CLICKED] Register/Stake button triggered! Modal: handleRegisterSatellite", {
      regName,
      regSatId,
      regNoradId,
      regStakeEth,
      walletAddress,
      isSubmitting,
      isGlobalTxPending,
      isCurrentRegDestroyed,
      isCurrentRegRegistered,
    });
    console.log("🔵 [REGISTER: START] Resolving Satellite target...", { regName, regSatId, regNoradId, regStakeEth, regPenaltyEth });

    if (!walletAddress) {
      console.warn("🔵 [REGISTER: BLOCKED] Wallet not connected.");
      setStatusMessage('⚠️ Please connect your MetaMask wallet first!');
      return;
    }

    const matchedCatalog = NORAD_SATELLITES.find(
      (s) => s.name === regName || s.name === regSatId || String(s.noradId) === regNoradId || s.id === regSatId
    );
    const selectedSat = matchedCatalog || currentRegSat || {
      noradId: parseInt(regNoradId, 10) || 0,
      norad_cat_id: parseInt(regNoradId, 10) || 0,
      id: regSatId,
      name: regName || regSatId,
    };

    // Strictly enforce NORAD ID as the on-chain mapping key
    const canonicalId = String(selectedSat.noradId || selectedSat.norad_cat_id || selectedSat.id).trim();
    const canonicalNorad = parseInt(canonicalId, 10) || selectedSat.noradId || (parseInt(regNoradId, 10) || 0);
    const displaySatName = selectedSat.name || regName || canonicalId;

    setIsGlobalTxPending(true);
    broadcastTxStarted();
    setStatusMessage('⏳ Please confirm registration in your MetaMask popup window...');

    try {
      const isCorrectNet = await web3Service.ensureHardhatNetwork();
      if (!isCorrectNet) {
        setStatusMessage('⚠️ Please switch your MetaMask network to Hardhat Localhost (Chain ID 31337).');
        return;
      }

      console.log("🔵 [REGISTER: ID RESOLVED] Canonical ID strictly evaluated as: ", canonicalId, {
        displaySatName,
        canonicalNorad,
        selectedSat,
      });

      // Check if already registered on-chain
      const apiPayload = {
        satId: canonicalId,
        noradId: canonicalNorad,
        satelliteName: displaySatName,
        operatorAddress: walletAddress,
        stakedEth: parseFloat(regStakeEth),
        liabilityPenaltyEth: parseFloat(regPenaltyEth),
      };

      console.log("🔵 [REGISTER: WEB3 CHECK] Checking if already registered on-chain...", { canonicalId });
      const alreadyRegistered = await web3Service.isRegisteredOnChain(canonicalId);
      console.log("🔵 [REGISTER: WEB3 CHECK RESULT] Is registered: ", alreadyRegistered);

      if (alreadyRegistered) {
        console.warn("🟠 [DESYNC DETECTED] Asset already on-chain but unregistered locally. Auto-healing database...");
        
        // 1. Sync to SQLite backend directly (bypass Web3 tx)
        const syncResult = await api.registerSatellite(apiPayload);
        
        // 2. Refresh the global Zustand store
        const fresh = await api.fetchSatellites();
        if (fresh?.length) {
          useSolarStore.getState().setBackendSatellites(fresh);
        } else if (syncResult?.satellite) {
          const currentFleet = useSolarStore.getState().backendSatellites;
          const updatedFleet = [syncResult.satellite, ...currentFleet.filter((s) => s.sat_id !== canonicalId && s.satellite_name !== displaySatName)];
          useSolarStore.getState().setBackendSatellites(updatedFleet);
        }
        setSelectedSatId(canonicalId);
        broadcastSatelliteRefresh();
        
        // 3. Log a special recovery transaction to the Right Drawer Ledger
        useSolarStore.getState().addWeb3Transaction({
          type: 'SYNC',
          satName: displaySatName,
          noradId: canonicalId,
          amount: parseFloat(regStakeEth),
          txHash: '0x_STATE_RECOVERY_SYNC',
          timestamp: Date.now(),
          actionType: 'ON-CHAIN STATE RECOVERED',
          satelliteName: displaySatName,
          valueEth: `SYNCED`,
        });

        // 4. Update status & exit function safely
        setStatusMessage(`✅ Synchronized existing on-chain asset "${displaySatName}" to local database.`);
        setIsGlobalTxPending(false);
        return;
      }

      // Step 1: Confirm registration on-chain first
      console.log("🔵 [REGISTER: WEB3] Sending to Smart Contract...", { canonicalId, stakeAmount: regStakeEth });
      const txHash = await web3Service.registerSatelliteOnChain(canonicalId, parseFloat(regStakeEth));
      console.log("🔵 [REGISTER: WEB3 SUCCESS] Tx Hash: ", txHash);
      console.log("🚀 [PIPELINE STEP 1: TX SUCCESS]", {
        action: 'REGISTER',
        txHash,
        canonicalId,
        displaySatName,
        amount: regStakeEth
      });

      // Step 2: Persist/sync to SQLite only after on-chain transaction confirmation
      console.log("🔵 [REGISTER: API] Syncing to SQLite Backend...", { payload: apiPayload });
      let syncResult: any = null;
      try {
        syncResult = await api.registerSatellite(apiPayload);
        console.log("🔵 [REGISTER: API SUCCESS] Sync response: ", syncResult);
      } catch (backendErr: any) {
        console.warn('SQLite DB registration note:', backendErr.response?.data?.error || backendErr.message);
      }

      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);

      // Instant optimistic reactive state update with confirmed record (0ms delay)
      const registeredRecord: BackendSatellite = syncResult?.satellite || {
        sat_id: canonicalId,
        norad_cat_id: canonicalNorad,
        satellite_name: displaySatName,
        operator_address: walletAddress.toLowerCase(),
        staked_amount_eth: parseFloat(regStakeEth),
        operational_status: 'ACTIVE',
      };

      const currentFleet = useSolarStore.getState().backendSatellites;
      const updatedFleet = [registeredRecord, ...currentFleet.filter((s) => s.sat_id !== canonicalId && s.satellite_name !== displaySatName)];
      useSolarStore.getState().setBackendSatellites(updatedFleet);
      setSelectedSatId(canonicalId);

      // Trigger authoritative re-fetch in background
      api.fetchSatellites().then((fresh) => {
        if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
      });

      // Broadcast instant cross-tab refresh signal
      broadcastSatelliteRefresh();

      addAuditLog(`🛰️ REGISTRATION: Satellite ${displaySatName} (NORAD #${canonicalId}) successfully registered with ${regStakeEth} ETH initial collateral.`);
      const txPayload = {
        timestamp: new Date().toISOString(),
        actionType: 'SATELLITE REGISTERED',
        satelliteName: displaySatName,
        noradId: canonicalId,
        valueEth: `${parseFloat(regStakeEth).toFixed(2)} ETH`,
        txHash: txHash || undefined,
      };
      console.log("📦 [PIPELINE STEP 2: DISPATCHING TO STORE]", txPayload);
      useSolarStore.getState().addWeb3Transaction(txPayload);
      setStatusMessage(`✅ Satellite ${displaySatName} registered on-chain (NORAD #${canonicalId}) & in SQLite DB! ${txHash ? '(Tx: ' + txHash.slice(0, 14) + '...)' : ''}`);
    } catch (err: any) {
      console.error("❌ [REGISTER: ERROR] Failed at: ", err.message, err);
      // Check if user rejected the transaction in MetaMask
      if (
        err?.code === 4001 ||
        err?.code === 'ACTION_REJECTED' ||
        err?.message?.toLowerCase().includes("user rejected") ||
        err?.info?.error?.code === 4001
      ) {
        useSolarStore.getState().addWeb3Transaction({
          type: 'REJECT',
          satName: displaySatName,
          noradId: canonicalId,
          amount: 0,
          txHash: 'USER_ABORTED',
          timestamp: Date.now(),
          actionType: 'TRANSACTION REJECTED',
          satelliteName: displaySatName,
          valueEth: 'ABORTED',
        });
        setStatusMessage(`⚠️ Registration cancelled by user in MetaMask.`);
      } else {
        const msg = err.reason || err.message || 'Registration failed or rejected';
        setStatusMessage(`⚠️ Registration error: ${msg}`);
      }
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleResetDatabase = async () => {
    setIsGlobalTxPending(true);
    broadcastTxStarted();
    console.warn("🟠 [RESET: START] Calling backend to clear SQLite dynamic rows...");
    setStatusMessage('⏳ Resetting backend SQLite database for live demo...');
    try {
      const res = await api.resetDatabase();
      console.warn("🟠 [RESET: SUCCESS] Database wiped. Re-fetching fleet...", res);
      const sats = await api.fetchSatellites();
      console.log("🟠 [RESET: HYDRATED] Fleet re-fetched after reset, count:", sats?.length || 0);
      useSolarStore.getState().setBackendSatellites(sats || []);
      useSolarStore.getState().clearDestroyed();
      broadcastSatelliteRefresh();
      addAuditLog('🗑️ DEMO RESET: Database conjunction events cleared and state re-seeded.');
      setStatusMessage('🎉 Database reset successfully! Conjunction events cleared for live demo.');
    } catch (err: any) {
      console.error("❌ [RESET: ERROR] Database reset failed: ", err.message, err);
      setStatusMessage(`⚠️ Reset error: ${err.message}`);
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleClearAuditLogs = async () => {
    clearAuditLogs();
    await api.clearAuditLogs();
    setStatusMessage('🗑️ Audit logs cleared successfully.');
  };

  const handleClaimFaucet = async () => {
    if (!walletAddress) return;
    setIsGlobalTxPending(true);
    broadcastTxStarted();
    setStatusMessage('🎁 Claiming 100 Test ETH from Hardhat Local Faucet...');
    try {
      const txHash = await web3Service.fundWalletWithTestEth(walletAddress, '100.0');
      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);
      setStatusMessage(`🎉 Received 100 Test ETH! Tx Hash: ${txHash.slice(0, 14)}...`);
    } catch (err: any) {
      setStatusMessage(`⚠️ Faucet error: ${err.message}`);
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '680px',
          background: 'rgba(7, 8, 12, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.14), 0 0 50px rgba(236, 72, 153, 0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Radial Lighting */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(5, 6, 10, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)',
              }}
            >
              <Coins size={18} style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '1px', color: '#ffffff' }}>
                KESSLERGRID WEB3 & BACKEND GATEWAY
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.4px' }}>
                Hardhat RPC: 127.0.0.1:8545 | SQLite DB: kessler.db (Port 5000)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleResetDatabase}
              disabled={isSubmitting}
              title="Clear SQLite DB & Reset Conjunction Events"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#f87171',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Trash2 size={12} />
              <span>CLEAR / RESET DATABASE</span>
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(5, 6, 10, 0.6)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <button
            onClick={() => setActiveTab('staking')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'staking' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'staking' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'staking' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Coins size={14} />
            <span>ON-CHAIN STAKING</span>
          </button>
          <button
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'register' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'register' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'register' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Radio size={14} />
            <span>REGISTER SATELLITE</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'logs' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'logs' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Terminal size={14} />
            <span>AUDIT LOGS ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto', position: 'relative', zIndex: 2 }}>
          {/* Wallet Status Header */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MetaMaskFoxIcon size={26} style={{ filter: 'drop-shadow(0 0 6px rgba(246, 133, 27, 0.4))' }} />
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  MetaMask Web3 Status
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isWeb3Connected ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                  {isWeb3Connected ? `CONNECTED: ${walletAddress}` : 'NOT CONNECTED'}
                </div>
              </div>
            </div>

            {isWeb3Connected ? (
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ETH Balance</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>{walletBalanceEth} ETH</div>
                </div>

                <button
                  onClick={handleClaimFaucet}
                  title="Claim 100 free Test ETH from local Hardhat node"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
                    border: '1px solid #10b981',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <Sparkles size={12} />
                  <span>FAUCET (+100 ETH)</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                style={{
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)',
                }}
              >
                CONNECT METAMASK
              </button>
            )}
          </div>

          {statusMessage && (
            <div
              style={{
                background: statusMessage.toLowerCase().includes('error') || statusMessage.includes('OFFLINE') || statusMessage.includes('not registered')
                  ? 'rgba(244, 63, 94, 0.12)'
                  : statusMessage.toLowerCase().includes('success') || statusMessage.includes('Connected')
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(56, 189, 248, 0.12)',
                border: statusMessage.toLowerCase().includes('error') || statusMessage.includes('OFFLINE') || statusMessage.includes('not registered')
                  ? '1px solid rgba(244, 63, 94, 0.35)'
                  : statusMessage.toLowerCase().includes('success') || statusMessage.includes('Connected')
                  ? '1px solid rgba(16, 185, 129, 0.35)'
                  : '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: statusMessage.toLowerCase().includes('error') || statusMessage.includes('OFFLINE') || statusMessage.includes('not registered')
                  ? '#fb7185'
                  : statusMessage.toLowerCase().includes('success') || statusMessage.includes('Connected')
                  ? '#34d399'
                  : '#38bdf8',
                marginBottom: '16px',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              {statusMessage.toLowerCase().includes('error') || statusMessage.includes('OFFLINE') ? (
                <AlertTriangle size={15} style={{ flexShrink: 0, color: '#f43f5e' }} />
              ) : statusMessage.toLowerCase().includes('success') || statusMessage.includes('Connected') ? (
                <CheckCircle2 size={15} style={{ flexShrink: 0, color: '#10b981' }} />
              ) : (
                <Activity size={15} style={{ flexShrink: 0, color: '#38bdf8' }} />
              )}
              <span>{statusMessage.replace(/[⚠️⏳✅❌]/g, '').trim()}</span>
            </div>
          )}

          {/* TAB 1: ON-CHAIN STAKING */}
          {activeTab === 'staking' && (
            <form onSubmit={handleExecuteStake} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  SELECT SATELLITE TO COLLATERALIZE
                </label>
                <select
                  value={selectedSatId}
                  onChange={(e) => {
                    setSelectedSatId(e.target.value);
                    setStatusMessage(null);
                  }}
                  disabled={isSubmitting || isGlobalTxPending}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: isCurrentStakingDestroyed ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: (isSubmitting || isGlobalTxPending) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uniqueNoradSatellites.map((sat) => {
                    const status = getSatelliteStatus(sat);
                    let prefix = '[UNREGISTERED]';
                    if (status === 'DESTROYED') {
                      prefix = '[DESTROYED]';
                    } else if (status === 'REGISTERED') {
                      prefix = '[REGISTERED]';
                    }
                    return (
                      <option key={sat.noradId} value={sat.noradId}>
                        {prefix} {sat.name} (NORAD #{sat.noradId})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Red Warning Banner for Destroyed Asset Selection */}
              {isCurrentStakingDestroyed && (
                <div
                  style={{
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#fb7185',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 0 15px rgba(244, 63, 94, 0.15)',
                  }}
                >
                  <AlertTriangle size={15} style={{ color: '#f43f5e', flexShrink: 0 }} />
                  <span>ASSET OFFLINE: Telemetry signal lost. Smart contract interactions and staking are disabled for destroyed assets.</span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  STAKE AMOUNT (ETH)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={stakeAmountEth}
                  disabled={isCurrentStakingDestroyed}
                  onChange={(e) => setStakeAmountEth(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                onClick={handleExecuteStake}
                disabled={isStakeDisabled}
                title={currentStakingStatus !== 'REGISTERED' ? "Satellite must be registered before staking." : undefined}
                style={{
                  marginTop: '8px',
                  background: isStakeDisabled
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                  border: isStakeDisabled ? '1px solid #64748b' : '1px solid rgba(56, 189, 248, 0.5)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: isStakeDisabled ? '#94a3b8' : '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '1px',
                  cursor: isStakeDisabled ? 'not-allowed' : 'pointer',
                  boxShadow: isStakeDisabled ? 'none' : '0 4px 20px rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Activity size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>PROCESSING...</span>
                  </>
                ) : isCurrentStakingDestroyed ? (
                  <>
                    <Skull size={15} />
                    <span>ASSET DESTROYED - STAKING DISABLED</span>
                  </>
                ) : currentStakingStatus !== 'REGISTERED' ? (
                  <>
                    <AlertTriangle size={15} />
                    <span>SATELLITE UNREGISTERED - STAKING DISABLED</span>
                  </>
                ) : (
                  <>
                    <Coins size={15} />
                    <span>EXECUTE ON-CHAIN STAKE DEPOSIT</span>
                  </>
                )}
              </button>
              {currentStakingStatus !== 'REGISTERED' && (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '11px',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    letterSpacing: '0.5px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>Satellite must be registered before staking.</span>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: BACKEND SATELLITE REGISTRATION */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSatellite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: '6px' }}>
                  SELECT SATELLITE FROM FLEET CATALOG (DROPDOWN)
                </label>
                <select
                  value={regName}
                  disabled={isSubmitting || isGlobalTxPending}
                  onChange={(e) => {
                    const selected = NORAD_SATELLITES.find(
                      (s) => s.name === e.target.value || String(s.noradId) === e.target.value || s.id === e.target.value
                    );
                    if (selected) {
                      setRegSatId(selected.name);
                      setRegNoradId(selected.noradId.toString());
                      setRegName(selected.name);
                      const status = getSatelliteStatus(selected);
                      if (status === 'DESTROYED') {
                        setStatusMessage('ASSET OFFLINE: Telemetry signal lost. Smart contract interactions and staking are disabled for destroyed assets.');
                      } else if (status === 'REGISTERED') {
                        setStatusMessage(`Satellite ${selected.name} is already registered on-chain.`);
                      } else {
                        setStatusMessage(null);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: isCurrentRegDestroyed ? '1px solid #f43f5e' : '1px solid rgba(56, 189, 248, 0.5)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px',
                    cursor: (isSubmitting || isGlobalTxPending) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="" disabled>-- Select a satellite from catalog --</option>
                  {uniqueNoradSatellites.map((sat) => {
                    const status = getSatelliteStatus(sat);
                    let prefix = '[UNREGISTERED]';
                    if (status === 'DESTROYED') {
                      prefix = '[DESTROYED]';
                    } else if (status === 'REGISTERED') {
                      prefix = '[REGISTERED]';
                    }
                    return (
                      <option key={`reg-opt-${sat.noradId || sat.id}`} value={sat.name}>
                        {prefix} {sat.name} (NORAD #{sat.noradId} | {sat.category})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Red Warning Banner for Destroyed Asset Selection */}
              {isCurrentRegDestroyed && (
                <div
                  style={{
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#fb7185',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 0 15px rgba(244, 63, 94, 0.15)',
                  }}
                >
                  <AlertTriangle size={15} style={{ color: '#f43f5e', flexShrink: 0 }} />
                  <span>ASSET OFFLINE: Telemetry signal lost. Smart contract interactions and staking are disabled for destroyed assets.</span>
                </div>
              )}

              {/* Green Notice for Already Registered Asset */}
              {isCurrentRegRegistered && !isCurrentRegDestroyed && (
                <div
                  style={{
                    background: 'rgba(52, 211, 153, 0.12)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#34d399',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    lineHeight: '1.4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 0 15px rgba(52, 211, 153, 0.15)',
                  }}
                >
                  <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span>ASSET REGISTERED ON-CHAIN: Satellite is already registered. Duplicate registration is disabled. Switch to Staking tab to deposit collateral.</span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  SATELLITE ID
                </label>
                <input
                  type="text"
                  value={regSatId}
                  disabled={isCurrentRegDestroyed}
                  onChange={(e) => setRegSatId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  NORAD CATALOG ID
                </label>
                <input
                  type="number"
                  value={regNoradId}
                  disabled={isCurrentRegDestroyed}
                  onChange={(e) => setRegNoradId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  SATELLITE NAME
                </label>
                <input
                  type="text"
                  value={regName}
                  disabled={isCurrentRegDestroyed}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    setRegSatId(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  INITIAL STAKE (ETH)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={regStakeEth}
                  disabled={isCurrentRegDestroyed}
                  onChange={(e) => setRegStakeEth(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#ec4899', display: 'block', marginBottom: '4px' }}>
                  LIABILITY PENALTY PRICE (ETH)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={regPenaltyEth}
                  disabled={isCurrentRegDestroyed}
                  onChange={(e) => setRegPenaltyEth(e.target.value)}
                  placeholder="5.0"
                  style={{
                    width: '100%',
                    background: '#07080c',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </div>

              <button
                type="submit"
                onClick={handleRegisterSatellite}
                disabled={isSubmitting || isCurrentRegDestroyed || isCurrentRegRegistered}
                style={{
                  marginTop: '8px',
                  background: (isCurrentRegDestroyed || isCurrentRegRegistered)
                    ? 'rgba(100, 116, 139, 0.25)'
                    : 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  border: (isCurrentRegDestroyed || isCurrentRegRegistered) ? '1px solid #64748b' : '1px solid rgba(236, 72, 153, 0.5)',
                  borderRadius: '8px',
                  padding: '11px',
                  color: (isCurrentRegDestroyed || isCurrentRegRegistered) ? '#94a3b8' : '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.8px',
                  cursor: (isSubmitting || isCurrentRegDestroyed || isCurrentRegRegistered) ? 'not-allowed' : 'pointer',
                  boxShadow: (isCurrentRegDestroyed || isCurrentRegRegistered) ? 'none' : '0 4px 20px rgba(236, 72, 153, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>REGISTERING...</span>
                  </>
                ) : isCurrentRegDestroyed ? (
                  <>
                    <Skull size={14} />
                    <span>ASSET DESTROYED - REGISTRATION DISABLED</span>
                  </>
                ) : isCurrentRegRegistered ? (
                  <>
                    <CheckCircle2 size={14} style={{ color: '#34d399' }} />
                    <span>ALREADY REGISTERED ON-CHAIN</span>
                  </>
                ) : (
                  <>
                    <Radio size={14} />
                    <span>REGISTER ON-CHAIN & IN SQLITE DB</span>
                  </>
                )}
              </button>

              {/* Visual Separation: Registered Fleet vs Unregistered Catalog */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* REGISTERED FLEET SECTION */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', marginBottom: '8px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} />
                    <span>REGISTERED FLEET ({activeRegisteredFleet.length} ACTIVE ON-CHAIN)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                    {activeRegisteredFleet.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No active satellites registered on-chain yet.</div>
                    ) : (
                      activeRegisteredFleet.map((sat) => (
                        <div
                          key={sat.sat_id}
                          style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={12} style={{ color: '#10b981' }} />
                            {sat.sat_id}
                          </span>
                          <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>NORAD #{sat.norad_cat_id}</span>
                          <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                            {`${sat.staked_amount_eth || 1.0} ETH COLLATERAL`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* DESTROYED ASSETS SECTION (SEPARATE UI GRAVEYARD) */}
                {destroyedFleet.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#f43f5e', marginBottom: '8px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Skull size={14} style={{ color: '#f43f5e' }} />
                      <span>DESTROYED ASSETS ({destroyedFleet.length} OFFLINE / CRITICAL)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                      {destroyedFleet.map((sat) => (
                        <div
                          key={sat.sat_id}
                          style={{
                            background: 'rgba(244, 63, 94, 0.08)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#fb7185', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Skull size={12} style={{ color: '#f43f5e' }} />
                            {sat.sat_id}
                          </span>
                          <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>NORAD #{sat.norad_cat_id}</span>
                          <span style={{ color: '#f43f5e', fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={11} />
                            OFFLINE / DESTROYED
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UNREGISTERED CATALOG SECTION */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', marginBottom: '8px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio size={14} style={{ color: '#38bdf8' }} />
                    <span>UNREGISTERED CATALOG ({NORAD_SATELLITES.filter(s => !backendSatellites.some(b => b.sat_id === s.name || b.satellite_name === s.name)).length} AVAILABLE)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                    {NORAD_SATELLITES.filter(s => !backendSatellites.some(b => b.sat_id === s.name || b.satellite_name === s.name)).slice(0, 10).map((sat) => (
                      <div
                        key={sat.id}
                        onClick={() => {
                          setRegSatId(sat.name);
                          setRegNoradId(sat.noradId.toString());
                          setRegName(sat.name);
                        }}
                        style={{
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{sat.name}</span>
                        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>NORAD #{sat.noradId} | {sat.category}</span>
                        <span style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 700 }}>+ AUTOFILL</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} style={{ color: '#38bdf8' }} />
                  <span>REAL-TIME BACKEND SENTINEL AUDIT FEED (SQLITE & MERKLE ANCHORING)</span>
                </span>
                <button
                  onClick={handleClearAuditLogs}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#f87171',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Trash2 size={11} />
                  <span>CLEAR AUDIT LOGS</span>
                </button>
              </div>
              <div
                style={{
                  background: 'rgba(5, 6, 10, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '11px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {auditLogs.length === 0 ? (
                  <div style={{ color: '#64748b' }}>No audit logs generated yet... Ingesting telemetry streams...</div>
                ) : (
                  auditLogs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        color: log.includes('CRITICAL') || log.includes('ALERT')
                          ? '#ef4444'
                          : log.includes('SUCCESS') || log.includes('ANCHOR')
                          ? '#10b981'
                          : '#38bdf8',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        paddingBottom: '4px',
                      }}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
