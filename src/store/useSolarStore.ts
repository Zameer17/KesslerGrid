import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BackendSatellite, ConjunctionAlert } from '../services/api';

export interface CatalogCategory {
  id: string;
  name: string;
  color: string;
  count: number;
}

export type CatalogSatelliteTuple = [
  string, // name
  number, // noradId
  number, // sma (semi-major axis in Earth radii)
  number, // ecc (eccentricity)
  number, // inc (inclination in deg)
  number, // raan (RAAN in deg)
  number, // argP (arg of pericenter in deg)
  number, // ma (mean anomaly in deg)
  number, // periodSec (period in seconds)
  number  // catCode (0 to 7)
];

export interface Web3TransactionEntry {
  id: string;
  timestamp: string | number;
  actionType: 'STAKE DEPLOYED' | 'SATELLITE REGISTERED' | 'AVOIDANCE BURN' | 'ON-CHAIN STATE RECOVERED' | string;
  satelliteName?: string;
  noradId: string | number;
  valueEth: string;
  txHash?: string;
  type?: string;
  satName?: string;
  amount?: number;
}

export interface LiveBlockEntry {
  number: number;
  hash: string;
  parentHash?: string;
  stateRoot?: string;
  timestamp: number;
  txCount?: number;
  gasUsed?: string | number;
  gasLimit?: string | number;
  miner?: string;
}

interface SolarStore {
  simDate: Date;
  timeSpeed: number; // 1 = realtime, 86400 = 1 day per sec
  isPlaying: boolean;
  focusedBody: string; // 'sun', 'earth', 'norad_44713', 'moon', etc.
  zoomTrigger: number;
  zoomDirection: number; // +1 = in, -1 = out

  // Satellite Fleet Controls & Filters
  showSatelliteOrbits: boolean;
  activeCategoryFilter: string; // 'ALL' or category id (e.g. 'constellation', 'navigation', etc.)
  catalogCategories: CatalogCategory[];
  catalogSatellites: CatalogSatelliteTuple[];

  // Backend REST API & Web3 Integration State
  backendSatellites: BackendSatellite[];
  conjunctionAlerts: ConjunctionAlert[];
  auditLogs: string[];
  web3Transactions: Web3TransactionEntry[];
  liveBlocks: LiveBlockEntry[];

  // Web3 Wallet State
  walletAddress: string | null;
  walletBalanceEth: string | null;
  isWeb3Connected: boolean;
  showWeb3Modal: boolean;
  showAuditModal: boolean;
  isCyberDrawerOpen: boolean;
  setIsCyberDrawerOpen: (val: boolean) => void;
  isGlobalTxPending: boolean;
  setIsGlobalTxPending: (val: boolean) => void;

  // Focus Collision Isolation Mode
  // Demo Session Destruction State
  destroyedDemoIds: string[];
  markAsDestroyed: (id: string | number) => void;
  resetDemoState: () => void;
  clearDestroyed: () => void;

  isFocusMode: boolean;
  demoFocusPair: [string, string] | null;
  toggleFocusMode: () => void;
  setIsFocusMode: (isFocusMode: boolean) => void;
  setDemoFocusPair: (pair: [string, string] | null) => void;

  setSimDate: (date: Date) => void;
  setTimeSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setFocusedBody: (id: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  toggleSatelliteOrbits: () => void;
  setActiveCategoryFilter: (filter: string) => void;
  setCatalogData: (categories: CatalogCategory[], satellites: CatalogSatelliteTuple[]) => void;

  setBackendSatellites: (sats: BackendSatellite[]) => void;
  setConjunctionAlerts: (alerts: ConjunctionAlert[]) => void;
  setAuditLogs: (logs: string[]) => void;
  clearAuditLogs: () => void;
  addAuditLog: (entry: string) => void;
  addWeb3Transaction: (tx: Omit<Web3TransactionEntry, 'id'>) => void;
  clearWeb3Transactions: () => void;
  addLiveBlock: (block: LiveBlockEntry) => void;
  clearLiveBlocks: () => void;

  setWalletState: (wallet: { address: string; balanceEth: string } | null) => void;
  setShowWeb3Modal: (show: boolean) => void;
  setShowAuditModal: (show: boolean) => void;

  getSatelliteStatus: (sat: any) => 'REGISTERED' | 'UNREGISTERED' | 'DESTROYED';
}

export const useSolarStore = create<SolarStore>()(
  persist(
    (set, get) => ({
  simDate: new Date(),
  timeSpeed: 288, // 1 Earth Day = 5 Minutes (300 Seconds)
  isPlaying: true,
  focusedBody: 'sun',
  zoomTrigger: 0,
  zoomDirection: 1,

  showSatelliteOrbits: true,
  activeCategoryFilter: 'ALL',
  catalogCategories: [],
  catalogSatellites: [],

  backendSatellites: [],
  conjunctionAlerts: [],
  auditLogs: [],
  web3Transactions: [],
  liveBlocks: [],

  walletAddress: null,
  walletBalanceEth: null,
  isWeb3Connected: false,
  showWeb3Modal: false,
  showAuditModal: false,
  isCyberDrawerOpen: false,
  isGlobalTxPending: false,
  setIsGlobalTxPending: (isGlobalTxPending: boolean) => set({ isGlobalTxPending }),
  destroyedDemoIds: [],
  markAsDestroyed: (id) =>
    set((state) => ({
      destroyedDemoIds: Array.from(new Set([...state.destroyedDemoIds, String(id)])),
    })),
  resetDemoState: () => set({ destroyedDemoIds: [] }),
  clearDestroyed: () => set({ destroyedDemoIds: [] }),

  isFocusMode: false,
  demoFocusPair: null,
  toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
  setIsFocusMode: (isFocusMode) => set({ isFocusMode }),
  setDemoFocusPair: (demoFocusPair) => set({ demoFocusPair }),

  setSimDate: (simDate) => set({ simDate }),
  setTimeSpeed: (timeSpeed) => set({ timeSpeed }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setFocusedBody: (focusedBody) => set({ focusedBody }),
  zoomIn: () => set((state) => ({ zoomTrigger: state.zoomTrigger + 1, zoomDirection: 1 })),
  zoomOut: () => set((state) => ({ zoomTrigger: state.zoomTrigger + 1, zoomDirection: -1 })),

  toggleSatelliteOrbits: () =>
    set((state) => ({ showSatelliteOrbits: !state.showSatelliteOrbits })),

  setActiveCategoryFilter: (activeCategoryFilter) => set({ activeCategoryFilter }),

  setCatalogData: (catalogCategories, catalogSatellites) =>
    set({ catalogCategories, catalogSatellites }),

  setBackendSatellites: (sats) =>
    set((state) => {
      const existingMap = new Map<string, BackendSatellite>();
      (state.backendSatellites || []).forEach((s) => {
        const key = (s.norad_cat_id && Number(s.norad_cat_id) > 0)
          ? `norad-${s.norad_cat_id}`
          : `id-${(s.sat_id || s.satellite_name || '').trim().toLowerCase()}`;
        existingMap.set(key, s);
      });
      (sats || []).forEach((s) => {
        const key = (s.norad_cat_id && Number(s.norad_cat_id) > 0)
          ? `norad-${s.norad_cat_id}`
          : `id-${(s.sat_id || s.satellite_name || '').trim().toLowerCase()}`;
        const prev = existingMap.get(key);
        existingMap.set(key, prev ? { ...prev, ...s } : s);
      });
      return { backendSatellites: Array.from(existingMap.values()) };
    }),
  setConjunctionAlerts: (conjunctionAlerts) => set({ conjunctionAlerts }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  clearAuditLogs: () => set({ auditLogs: [] }),
  addAuditLog: (entry: string) =>
    set((state) => ({
      auditLogs: [
        `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${entry}`,
        ...state.auditLogs,
      ],
    })),
  addWeb3Transaction: (tx) => {
    console.log("💾 [STORE] Adding Web3 transaction:", tx);
    set((state) => {
      const fullTx = {
        ...tx,
        id: (tx as any).id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: tx.timestamp || new Date().toISOString(),
      };
      const updated = [fullTx, ...(state.web3Transactions || [])];
      console.log("📊 [PIPELINE STEP 4: NEW STORE STATE ARRAY LENGTH]", updated.length);
      // Immediately sync to localStorage as fail-safe backup
      try {
        localStorage.setItem('kessler-grid-web3-backup', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to back up transactions", e);
      }
      return { web3Transactions: updated };
    });
  },
  clearWeb3Transactions: () => {
    try {
      localStorage.removeItem('kessler-grid-web3-backup');
    } catch (e) {}
    set({ web3Transactions: [] });
  },
  addLiveBlock: (block) =>
    set((state) => {
      const existing = (state.liveBlocks || []).filter(
        (b) => b.number !== block.number && (!block.hash || b.hash !== block.hash)
      );
      const combined = [block, ...existing].sort((a, b) => b.number - a.number).slice(0, 30);
      return {
        liveBlocks: combined,
      };
    }),
  clearLiveBlocks: () => set({ liveBlocks: [] }),

  setWalletState: (wallet) =>
    set({
      walletAddress: wallet?.address || null,
      walletBalanceEth: wallet?.balanceEth || null,
      isWeb3Connected: !!wallet,
    }),

  setShowWeb3Modal: (showWeb3Modal) => set({ showWeb3Modal }),
  setShowAuditModal: (showAuditModal) => set({ showAuditModal }),
  setIsCyberDrawerOpen: (isCyberDrawerOpen) => set({ isCyberDrawerOpen }),

  getSatelliteStatus: (sat: any) => {
    if (!sat) return 'UNREGISTERED';
    const state = get();
    const sName = (sat.name || sat.satellite_name || sat.sat_id || '').trim();
    const sNorad = sat.noradId !== undefined && sat.noradId !== null
      ? String(sat.noradId).trim()
      : sat.norad_cat_id !== undefined && sat.norad_cat_id !== null
      ? String(sat.norad_cat_id).trim()
      : '';
    const sId = (sat.id || sat.sat_id || sName).trim();
    const hasValidNorad = sNorad !== '' && sNorad !== '0' && !isNaN(Number(sNorad));

    // 1. Check destroyed status locally in current demo session or directly on sat
    const isDestroyed =
      (sName && state.destroyedDemoIds.includes(sName)) ||
      (sNorad && state.destroyedDemoIds.includes(sNorad)) ||
      (sId && state.destroyedDemoIds.includes(sId)) ||
      sat.operational_status === 'DESTROYED' ||
      sat.operationalStatus === 'DESTROYED' ||
      sat.status === 'DESTROYED';

    if (isDestroyed) return 'DESTROYED';

    // 2. Direct evaluation of registration state on the satellite object itself (camelCase & snake_case)
    const isSatSelfRegistered = Boolean(
      sat.isRegistered ||
      sat.is_registered ||
      (Number(sat.staked_eth) > 0) ||
      (Number(sat.stakedEth) > 0) ||
      (Number(sat.staked_amount_eth) > 0) ||
      sat.on_chain_status === 'REGISTERED' ||
      sat.onChainStatus === 'REGISTERED' ||
      sat.operational_status === 'REGISTERED' ||
      sat.operationalStatus === 'REGISTERED' ||
      (sat.operator_address &&
        sat.operator_address !== 'UNREGISTERED' &&
        String(sat.operator_address).toLowerCase().startsWith('0x')) ||
      (sat.operatorAddress &&
        sat.operatorAddress !== 'UNREGISTERED' &&
        String(sat.operatorAddress).toLowerCase().startsWith('0x'))
    );

    // 3. Cross-reference backendSatellites fleet from Zustand store
    const backendRec = state.backendSatellites.find((b) => {
      if (hasValidNorad && b.norad_cat_id && Number(b.norad_cat_id) === Number(sNorad)) return true;
      if (sName && b.sat_id && b.sat_id.trim().toLowerCase() === sName.toLowerCase()) return true;
      if (sName && b.satellite_name && b.satellite_name.trim().toLowerCase() === sName.toLowerCase()) return true;
      if (sId && b.sat_id && b.sat_id.trim().toLowerCase() === sId.toLowerCase()) return true;
      if (sId && (b as any).id && String((b as any).id) === sId) return true;
      return false;
    });

    if (backendRec && (backendRec.operational_status === 'DESTROYED' || (backendRec as any).status === 'DESTROYED')) {
      return 'DESTROYED';
    }

    const isBackendRegistered = Boolean(
      backendRec &&
      backendRec.operational_status !== 'DESTROYED' &&
      (
        (backendRec as any).isRegistered ||
        (backendRec as any).is_registered ||
        (backendRec as any).on_chain_status === 'REGISTERED' ||
        (backendRec as any).onChainStatus === 'REGISTERED' ||
        (backendRec.operational_status === 'REGISTERED') ||
        (Number(backendRec.staked_amount_eth) > 0) ||
        (Number((backendRec as any).staked_eth) > 0) ||
        (Number((backendRec as any).stakedEth) > 0) ||
        (backendRec.operator_address &&
          backendRec.operator_address !== 'UNREGISTERED' &&
          String(backendRec.operator_address).toLowerCase().startsWith('0x')) ||
        ((backendRec as any).operatorAddress &&
          (backendRec as any).operatorAddress !== 'UNREGISTERED' &&
          String((backendRec as any).operatorAddress).toLowerCase().startsWith('0x'))
      )
    );

    if (isSatSelfRegistered || isBackendRegistered) {
      return 'REGISTERED';
    }

    return 'UNREGISTERED';
  },
}),
  {
    name: 'kessler-grid-storage',
    partialize: (state) => ({
      web3Transactions: state.web3Transactions,
    }),
    merge: (persistedState: unknown, currentState: SolarStore): SolarStore => {
      // Fallback to direct localStorage backup if persistedState is empty
      let backupTxs: any[] = [];
      try {
        const raw = localStorage.getItem('kessler-grid-web3-backup');
        if (raw) backupTxs = JSON.parse(raw);
      } catch (e) {}

      const pState = persistedState as Partial<SolarStore> | undefined;

      const mergedTxs = [
        ...(pState?.web3Transactions || []),
        ...backupTxs,
        ...(currentState?.web3Transactions || [])
      ].filter((tx: any, index: number, self: any[]) => 
        index === self.findIndex((t: any) => 
          (t.txHash && t.txHash !== 'USER_ABORTED' && t.txHash === tx.txHash) || (t.id && t.id === tx.id)
        )
      );

      return {
        ...currentState,
        web3Transactions: mergedTxs,
      };
    },
  }
)
);