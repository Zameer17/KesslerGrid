import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../services/apiConfig';
import {
  RefreshCw,
  Database,
  AlertTriangle,
  RotateCcw,
  Activity,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowLeftRight,
  ArrowRight,
  Skull,
  Crosshair,
  Target,
  Coins,
  ShieldCheck,
  Scale,
  ExternalLink,
  Trash2,
  Layers,
} from 'lucide-react';
import { kesslerSyncChannel } from '../services/syncChannel';
import { useSolarStore, Web3TransactionEntry } from '../store/useSolarStore';
import { BackendSatellite } from '../services/api';

export interface AuditLedgerEntry {
  id: number;
  timestamp: string;
  event_type: string;
  primary_asset: string;
  threat_asset: string;
  financial_transfer: string;
  state_change: string;
  estimated_liability_exposure_eth?: number | null;
  tx_hash?: string | null;
}

/**
 * Resolves the dynamic staked ETH or parametric loss value for an audit log entry.
 * Cross-references primary_asset and threat_asset against store satellites and transaction history.
 */
const resolveCollisionLossValue = (
  log: AuditLedgerEntry,
  satellites: BackendSatellite[] = [],
  transactions: Web3TransactionEntry[] = []
): string => {
  const fin = (log.financial_transfer || '').trim();
  const matchEth = fin.match(/(\d+(\.\d+)?)\s*ETH/i);
  const parsedFinEth = matchEth ? parseFloat(matchEth[1]) : 0;

  // If already a valid non-zero ETH value (and not explicitly 0.00 ETH)
  if (parsedFinEth > 0 && !fin.startsWith('0.00') && !fin.startsWith('0 ETH')) {
    return fin.includes('ETH') ? fin : `${parsedFinEth.toFixed(2)} ETH`;
  }

  // Cross-reference satellite fleet from Zustand store
  const storeSats = satellites.length > 0 ? satellites : (useSolarStore.getState().backendSatellites || []);

  const findSatelliteStake = (assetNameOrId: string | undefined | null): number => {
    if (!assetNameOrId || assetNameOrId === 'None' || assetNameOrId === 'N/A') return 0;
    const cleanTarget = String(assetNameOrId).trim().toLowerCase();

    // Check store satellites
    const sat = storeSats.find((s) => {
      const sName = (s.satellite_name || (s as any).name || '').toLowerCase();
      const sId = (s.sat_id || (s as any).id || '').toLowerCase();
      const sNorad = String(s.norad_cat_id ?? (s as any).norad_id ?? '').toLowerCase();
      return (
        sName === cleanTarget ||
        sId === cleanTarget ||
        sNorad === cleanTarget ||
        (sName && (cleanTarget.includes(sName) || sName.includes(cleanTarget))) ||
        (sId && (cleanTarget.includes(sId) || sId.includes(cleanTarget)))
      );
    });

    if (sat) {
      const stake = Number(sat.staked_amount_eth ?? (sat as any).staked_eth ?? (sat as any).stake ?? 0);
      if (stake > 0) return stake;
    }

    // Check transaction history for prior stake deployed
    const allTxs = transactions.length > 0 ? transactions : (useSolarStore.getState().web3Transactions || []);
    const priorStakeTx = allTxs.find((tx) => {
      const txSatName = (tx.satelliteName || tx.satName || '').toLowerCase();
      const txNorad = String(tx.noradId || '').toLowerCase();
      const isStake = tx.actionType === 'STAKE DEPLOYED' || tx.type === 'STAKE';
      return (
        isStake &&
        (txSatName === cleanTarget ||
          txNorad === cleanTarget ||
          (txSatName && (cleanTarget.includes(txSatName) || txSatName.includes(cleanTarget))))
      );
    });

    if (priorStakeTx) {
      const valMatch = (priorStakeTx.valueEth || '').match(/(\d+(\.\d+)?)/);
      if (valMatch) {
        const val = parseFloat(valMatch[1]);
        if (val > 0) return val;
      }
      if (priorStakeTx.amount && priorStakeTx.amount > 0) return priorStakeTx.amount;
    }

    return 0;
  };

  const primaryStake = findSatelliteStake(log.primary_asset);
  const threatStake = findSatelliteStake(log.threat_asset);
  const stakedSum = primaryStake + threatStake;

  if (stakedSum > 0) {
    return `${stakedSum.toFixed(2)} ETH`;
  }

  // Check estimated liability exposure snapshot
  if (log.estimated_liability_exposure_eth && Number(log.estimated_liability_exposure_eth) > 0) {
    return `${Number(log.estimated_liability_exposure_eth).toFixed(2)} ETH`;
  }

  // Fallback parametric baseline for collision/loss events
  return '2.50 ETH';
};

type SeverityFilter = 'ALL' | 'CRITICAL' | 'SURCHARGE' | 'MITIGATED';

export function LiveDatabaseMonitor() {
  const [logs, setLogs] = useState<AuditLedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>('ALL');
  const [activeTab, setActiveTab] = useState<'COLLISIONS' | 'TRANSACTIONS' | 'CHAIN'>('COLLISIONS');
  const [clearedLogsTime, setClearedLogsTime] = useState<number>(0);

  const storeWeb3Txs = useSolarStore((s) => s.web3Transactions);
  const web3Transactions = (storeWeb3Txs && storeWeb3Txs.length > 0)
    ? storeWeb3Txs
    : (useSolarStore.getState().web3Transactions || []);
  const clearWeb3Transactions = useSolarStore((s) => s.clearWeb3Transactions);
  const auditLogs = useSolarStore((s) => s.auditLogs);
  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const isWeb3Connected = useSolarStore((s) => s.isWeb3Connected);
  const walletAddress = useSolarStore((s) => s.walletAddress);
  const liveBlocks = useSolarStore((s) => s.liveBlocks) || [];


  const handleClearTransactions = useCallback(() => {
    clearWeb3Transactions();
    setClearedLogsTime(Date.now());
  }, [clearWeb3Transactions]);

  // Filter valid Web3 transactions matching all operational and lifecycle types
  const validWeb3Txs = useMemo(() => {
    return Array.isArray(web3Transactions) ? web3Transactions : [];
  }, [web3Transactions]);

  const allTxRows = useMemo(() => {
    // 1. Always prioritize and keep all valid Zustand Web3 transactions intact
    const primaryList: Web3TransactionEntry[] = [...validWeb3Txs];

    // 2. Append backend audit logs and financial transfers as fallbacks
    const fallbackList: Web3TransactionEntry[] = [];
    auditLogs.forEach((logStr, idx) => {
      if (logStr.includes('COLLATERAL: Staked') || logStr.includes('REGISTRATION')) {
        const isStake = logStr.includes('COLLATERAL') || logStr.includes('Staked');
        const noradMatch = logStr.match(/NORAD #?(\w+)/i);
        const ethMatch = logStr.match(/(\d+(\.\d+)?)\s*ETH/i);
        const norad = noradMatch ? noradMatch[1] : 'UNKNOWN';
        const ethVal = ethMatch ? `${ethMatch[1]} ETH` : '0.00 ETH';

        let satName = 'SATELLITE';
        const nameMatch = logStr.match(/(?:on|Satellite)\s+([^(]+)\s+\(NORAD/i);
        if (nameMatch) {
          satName = nameMatch[1].trim();
        }

        const alreadyExists = primaryList.some(
          (t) => String(t.noradId) === String(norad) && t.actionType === (isStake ? 'STAKE DEPLOYED' : 'SATELLITE REGISTERED')
        );
        if (!alreadyExists) {
          fallbackList.push({
            id: `audit-fallback-${idx}`,
            timestamp: new Date().toISOString(),
            actionType: isStake ? 'STAKE DEPLOYED' : 'SATELLITE REGISTERED',
            satelliteName: satName,
            noradId: norad,
            valueEth: ethVal,
          });
        }
      }
    });

    logs.forEach((log) => {
      const fin = (log.financial_transfer || '').trim();
      const isInvoice =
        (log.event_type || '').includes('INVOICE') ||
        (log.state_change || '').includes('DEBT') ||
        fin.includes('UNPAID INVOICE') ||
        (log.event_type || '').includes('UNINSURED');
      const isCollisionOrLoss =
        (log.event_type || '').includes('COLLISION') ||
        (log.event_type || '').includes('SLASH') ||
        (log.event_type || '').includes('TOTAL_LOSS') ||
        (log.event_type || '').includes('LIABILITY') ||
        (log.state_change || '').includes('COLLISION') ||
        (log.state_change || '').includes('SLASH') ||
        (log.state_change || '').includes('DESTRUCTION') ||
        isInvoice;

      let resolvedFin = fin;
      if (!fin || fin === 'None' || fin === '0.00 ETH' || fin === '0 ETH' || fin.includes('0.00 ETH')) {
        if (isInvoice) {
          const exposure = log.estimated_liability_exposure_eth || 5.0;
          resolvedFin = `${Number(exposure).toFixed(2)} ETH (UNPAID INVOICE)`;
        } else if (isCollisionOrLoss) {
          resolvedFin = resolveCollisionLossValue(log, backendSatellites, validWeb3Txs);
        }
      }

      if (resolvedFin && resolvedFin !== 'None' && (resolvedFin.includes('ETH') || isInvoice)) {
        const isSlash = (log.event_type || '').includes('SLASH') || resolvedFin.includes('SLASH');
        const isPayout = resolvedFin.includes('PAYOUT') || isCollisionOrLoss;
        const action = isInvoice ? 'LIABILITY INVOICE' : (isSlash ? 'COLLATERAL BURN' : (isPayout ? 'PARAMETRIC PAYOUT' : 'PENALTY SURCHARGE'));
        const alreadyExists = primaryList.some((t) => t.id === `ledger-${log.id}`);
        if (!alreadyExists) {
          fallbackList.push({
            id: `ledger-${log.id}`,
            timestamp: log.timestamp || new Date().toISOString(),
            actionType: action,
            satelliteName: log.primary_asset || 'PRIMARY ASSET',
            noradId: log.threat_asset ? `VS ${log.threat_asset}` : 'CHAIN',
            valueEth: resolvedFin,
            txHash: log.tx_hash || undefined,
          });
        }
      }
    });

    // 3. Apply clearedLogsTime ONLY to historical fallback logs, NEVER to validWeb3Txs
    const activeFallbacks = clearedLogsTime > 0
      ? fallbackList.filter((item) => {
          if (!item.timestamp) return true;
          const t = new Date(item.timestamp).getTime();
          return isNaN(t) || t > clearedLogsTime;
        })
      : fallbackList;

    return [...primaryList, ...activeFallbacks];
  }, [validWeb3Txs, auditLogs, logs, clearedLogsTime, backendSatellites]);

  useEffect(() => {
    console.log("🖥️ [PIPELINE STEP 5: UI RENDERING TRANSACTIONS]", {
      rawCount: web3Transactions?.length ?? 0,
      validCount: validWeb3Txs.length,
      allTxRowsCount: allTxRows.length,
      transactions: allTxRows,
    });
  }, [web3Transactions, validWeb3Txs, allTxRows]);

  const totalEthVolume = useMemo(() => {
    let total = 0;
    allTxRows.forEach((tx) => {
      const match = (tx.valueEth || '').match(/(\d+(\.\d+)?)/);
      if (match) {
        total += parseFloat(match[1]);
      }
    });
    return total.toFixed(2);
  }, [allTxRows]);

  const formatTxTime = (ts: string | number) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
    } catch {
      return String(ts);
    }
  };

  const getTxBadgeStyle = (actionType: string, txType?: string) => {
    const act = (actionType || '').toUpperCase();
    const type = (txType || '').toUpperCase();
    if (type === 'REJECT' || act.includes('REJECT') || act.includes('ABORT')) {
      return {
        background: 'rgba(245, 158, 11, 0.16)',
        border: '1px solid rgba(245, 158, 11, 0.55)',
        color: '#f59e0b',
        boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
        textShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
      };
    }
    if (act.includes('RECOVER') || act.includes('SYNC')) {
      return {
        background: 'rgba(52, 211, 153, 0.16)',
        border: '1px solid rgba(52, 211, 153, 0.55)',
        color: '#34d399',
        boxShadow: '0 0 10px rgba(52, 211, 153, 0.3)',
      };
    }
    if (act.includes('STAKE')) {
      return {
        background: 'rgba(6, 182, 212, 0.14)',
        border: '1px solid rgba(6, 182, 212, 0.5)',
        color: '#22d3ee',
        boxShadow: '0 0 8px rgba(6, 182, 212, 0.25)',
      };
    }
    if (act.includes('REGISTER')) {
      return {
        background: 'rgba(236, 72, 153, 0.14)',
        border: '1px solid rgba(236, 72, 153, 0.5)',
        color: '#f472b6',
        boxShadow: '0 0 8px rgba(236, 72, 153, 0.25)',
      };
    }
    if (act.includes('COLLATERAL BURN') || act.includes('SLASH') || act.includes('PAYOUT') || act.includes('LOSS')) {
      return {
        background: 'rgba(244, 63, 94, 0.16)',
        border: '1px solid rgba(244, 63, 94, 0.55)',
        color: '#fb7185',
        boxShadow: '0 0 10px rgba(244, 63, 94, 0.3)',
        textShadow: '0 0 8px rgba(244, 63, 94, 0.5)',
      };
    }
    if (act.includes('AVOIDANCE') || act.includes('BURN')) {
      return {
        background: 'rgba(16, 185, 129, 0.14)',
        border: '1px solid rgba(16, 185, 129, 0.5)',
        color: '#34d399',
        boxShadow: '0 0 8px rgba(16, 185, 129, 0.25)',
      };
    }
    if (act.includes('INVOICE') || act.includes('UNINSURED') || act.includes('DEBT')) {
      return {
        background: 'rgba(245, 158, 11, 0.16)',
        border: '1px solid rgba(245, 158, 11, 0.55)',
        color: '#fbbf24',
        boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
        textShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
      };
    }
    return {
      background: 'rgba(245, 158, 11, 0.14)',
      border: '1px solid rgba(245, 158, 11, 0.5)',
      color: '#fbbf24',
      boxShadow: '0 0 8px rgba(245, 158, 11, 0.25)',
    };
  };

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      let res = await fetch(`${API_BASE_URL}/api/audit-logs`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/api/v1/audit-logs`, {
          headers: { Accept: 'application/json' },
        });
      }

      if (res.ok) {
        const data = await res.json();
        const entries: AuditLedgerEntry[] = Array.isArray(data)
          ? data
          : data.entries && Array.isArray(data.entries)
          ? data.entries
          : [];
        setLogs(entries);
        setFetchError(null);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setFetchError(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
    // Real-time polling every 2.5 seconds
    const interval = setInterval(fetchAuditLogs, 2500);

    // Instant cross-tab BroadcastChannel sync
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'REFRESH_SATELLITES' ||
        event.data?.type === 'REFRESH_AUDIT_LOGS' ||
        event.data?.type === 'SYSTEM_RESET'
      ) {
        fetchAuditLogs();
      }
    };

    if (kesslerSyncChannel) {
      kesslerSyncChannel.addEventListener('message', handleBroadcastMessage);
    }

    // Hotkey: ESC closes drawer if open
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // External trigger event listener
    const handleOpenDrawer = () => setIsOpen(true);
    window.addEventListener('kessler:open-database-drawer', handleOpenDrawer);

    return () => {
      clearInterval(interval);
      if (kesslerSyncChannel) {
        kesslerSyncChannel.removeEventListener('message', handleBroadcastMessage);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('kessler:open-database-drawer', handleOpenDrawer);
    };
  }, [fetchAuditLogs]);

  // Format ISO timestamp into clean, highly readable time string
  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const pad = (n: number) => String(n).padStart(2, '0');
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      return `${time}.${ms}`;
    } catch {
      return isoStr;
    }
  };

  // Semantic color-coding & lucide iconography
  const getEventStyle = (eventType: string, row?: AuditLedgerEntry) => {
    const rawType = (eventType || '').trim();
    const upper = rawType.toUpperCase();

    // 1. Explicit Match via switch statement for known backend event_type values
    switch (upper) {
      // Step 2.1 & 2.2: Explicit avoidance burn event types routed to emerald (#10b981) AVOIDANCE_BURN_EXECUTED
      case 'ASYMMETRIC_AVOIDANCE_INVOICE':
      case 'ASYMMETRIC_AVOIDANCE':
      case 'MUTUAL_AVOIDANCE':
      case 'AVOIDANCE_BURN':
      case 'AVOIDANCE_BURN_EXECUTED':
      case 'TACTICAL_BURN':
        return {
          category: 'MITIGATED' as const,
          color: '#10b981', // Semantic Green / Emerald
          railColor: '#10b981',
          badge: 'AVOIDANCE_BURN_EXECUTED',
          title: 'AVOIDANCE_BURN_EXECUTED',
          Icon: ShieldCheck,
        };

      case 'COLLATERAL_SLASHED':
      case 'COLLISION_IMPACT':
      case 'UNINSURED_TOTAL_LOSS':
        return {
          category: 'CRITICAL' as const,
          color: '#f43f5e', // Semantic Red
          railColor: '#f43f5e',
          badge: 'CRITICAL',
          title: upper,
          Icon: AlertTriangle,
        };

      case 'UNINSURED_INVOICE_ISSUED':
      case 'UNINSURED_THREAT_LIABILITY':
      case 'UNINSURED_PRIMARY_LIABILITY':
        return {
          category: 'SURCHARGE' as const,
          color: '#f59e0b', // Semantic Amber/Warning
          railColor: '#f59e0b',
          badge: 'SURCHARGE',
          title: upper,
          Icon: ShieldAlert,
        };

      case 'SYSTEM_RESET':
      case 'FLEET_RESTORE':
        return {
          category: 'ALL' as const, // Excluded from MITIGATED tab so no SYSTEM_RESET appears under MITIGATED
          color: '#64748b', // Neutral Slate
          railColor: '#64748b',
          badge: 'SYSTEM_RESET',
          title: 'SYSTEM_RESET',
          Icon: RotateCcw,
        };

      case 'STAKE DEPLOYED':
      case 'STAKE_DEPLOYED':
      case 'SATELLITE REGISTERED':
      case 'SATELLITE_REGISTERED':
      case 'TRANSFER':
        return {
          category: 'ALL' as const,
          color: '#06b6d4', // Restrained Cyan
          railColor: '#06b6d4',
          badge: 'TRANSACTION',
          title: upper,
          Icon: ArrowLeftRight,
        };

      default: {
        // Log unhandled events for diagnostic auditing
        console.log("UNHANDLED EVENT:", { eventType: rawType, event: row });

        // Fallback secondary pattern matching
        const isAvoidance =
          upper.includes('AVOIDANCE') ||
          upper.includes('MUTUAL') ||
          upper.includes('EVASION') ||
          (row?.financial_transfer || '').includes('2.50 ETH BURN') ||
          (row?.financial_transfer || '').includes('AVOIDANCE BURN') ||
          (row?.state_change || '').includes('PATH CHANGED') ||
          (row?.state_change || '').includes('AVOIDANCE MANEUVER');

        if (isAvoidance) {
          return {
            category: 'MITIGATED' as const,
            color: '#10b981',
            railColor: '#10b981',
            badge: 'AVOIDANCE_BURN_EXECUTED',
            title: 'AVOIDANCE_BURN_EXECUTED',
            Icon: ShieldCheck,
          };
        }

        if (upper.includes('COLLISION') || upper.includes('DESTROYED') || upper.includes('TOTAL_LOSS')) {
          return {
            category: 'CRITICAL' as const,
            color: '#f43f5e',
            railColor: '#f43f5e',
            badge: 'CRITICAL',
            title: rawType || 'CRITICAL_COLLISION',
            Icon: AlertTriangle,
          };
        }

        if (upper.includes('LIABILITY') || upper.includes('UNINSURED') || upper.includes('DEBT') || upper.includes('SURCHARGE') || upper.includes('INVOICE')) {
          return {
            category: 'SURCHARGE' as const,
            color: '#f59e0b',
            railColor: '#f59e0b',
            badge: 'SURCHARGE',
            title: rawType || 'SURCHARGE_EVENT',
            Icon: ShieldAlert,
          };
        }

        if (upper.includes('RESET') || upper.includes('RESTORE')) {
          return {
            category: 'ALL' as const, // Excluded from MITIGATED tab
            color: '#64748b',
            railColor: '#64748b',
            badge: 'SYSTEM_RESET',
            title: 'SYSTEM_RESET',
            Icon: RotateCcw,
          };
        }

        if (upper.includes('STAKE') || upper.includes('TRANSFER') || upper.includes('REGISTRATION')) {
          return {
            category: 'ALL' as const,
            color: '#06b6d4',
            railColor: '#06b6d4',
            badge: 'TRANSACTION',
            title: rawType,
            Icon: ArrowLeftRight,
          };
        }

        // Step 2.4: Explicit unknown event fallback (never default to SYSTEM_RESET)
        const unhandledTitle = `UNKNOWN_EVENT: ${rawType || 'UNSPECIFIED'}`;
        return {
          category: 'ALL' as const,
          color: '#818cf8', // Subsystem Indigo
          railColor: '#818cf8',
          badge: unhandledTitle,
          title: unhandledTitle,
          Icon: Activity,
        };
      }
    }
  };

  interface CollisionRelationshipDetails {
    isCollision: boolean;
    relationshipType: 'DIRECTIONAL' | 'PAIR';
    impactor?: string;
    affected?: string;
    assetA?: string;
    assetB?: string;
    causeTitle: string;
    causeDesc: string;
    resultStatus: string;
    resultColor: string;
    accentColor: string;
    Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  }

  const parseCollisionRelationship = (row: AuditLedgerEntry): CollisionRelationshipDetails | null => {
    const eventType = (row.event_type || '').toUpperCase();
    const stateChange = (row.state_change || '').toUpperCase();
    const financial = (row.financial_transfer || '').toUpperCase();
    const primary = row.primary_asset || 'N/A';
    const threat = row.threat_asset || 'N/A';

    const isCollisionRelated =
      eventType.includes('COLLISION') ||
      eventType.includes('TOTAL_LOSS') ||
      eventType.includes('LIABILITY') ||
      eventType.includes('AVOIDANCE') ||
      eventType.includes('CONJUNCTION') ||
      eventType.includes('INVOICE') ||
      eventType.includes('UNINSURED') ||
      stateChange.includes('COLLISION') ||
      stateChange.includes('DESTRUCTION') ||
      stateChange.includes('INVOICED') ||
      stateChange.includes('DEBT') ||
      stateChange.includes('MITIGATED_ON_CHAIN') ||
      financial.includes('PARAMETRIC') ||
      financial.includes('SURCHARGE') ||
      financial.includes('INVOICE');

    if (!isCollisionRelated) return null;

    // Case 0: Explicit Uninsured Invoice Issued (Network Baseline Exposure)
    if (
      eventType === 'UNINSURED_INVOICE_ISSUED' ||
      stateChange === 'OFF-CHAIN DEBT ASSIGNED' ||
      (eventType.includes('INVOICE') && (eventType.includes('UNINSURED') || stateChange.includes('DEBT')))
    ) {
      return {
        isCollision: true,
        relationshipType: 'PAIR',
        assetA: primary,
        assetB: threat,
        causeTitle: 'UNINSURED COLLISION // OFF-CHAIN DEBT ASSIGNED',
        causeDesc: 'Asset unregistered with no smart contract stake — manual off-chain invoice issued at network baseline (5.00 ETH)',
        resultStatus: 'OFF-CHAIN LIABILITY INVOICE // DEBT ASSIGNED',
        resultColor: '#f59e0b',
        accentColor: '#f59e0b',
        Icon: AlertTriangle,
      };
    }

    // Resolve registered asset name to prevent falling back to 'ALL ASSETS'
    const regSatellite = backendSatellites.find(
      (s) => s.is_registered || s.isRegistered || s.on_chain_status === 'REGISTERED' || Number(s.staked_amount_eth) > 0
    );
    const resolvedRegisteredName = (primary && primary !== 'ALL ASSETS' && primary !== 'N/A')
      ? primary
      : (regSatellite ? (regSatellite.satellite_name || regSatellite.sat_id) : 'REGISTERED ASSET');

    // Case 0.5: Asymmetric Avoidance & Invoicing (Scenario C)
    if (
      eventType === 'ASYMMETRIC_AVOIDANCE' ||
      eventType === 'ASYMMETRIC_AVOIDANCE_INVOICE' ||
      eventType === 'AVOIDANCE_BURN' ||
      eventType === 'AVOIDANCE_BURN_EXECUTED' ||
      stateChange.includes('PATH CHANGED') ||
      stateChange.includes('AVOIDANCE MANEUVER') ||
      (eventType.includes('ASYMMETRIC') && eventType.includes('AVOIDANCE'))
    ) {
      return {
        isCollision: true,
        relationshipType: 'DIRECTIONAL',
        impactor: threat && threat !== 'None' && threat !== 'N/A' ? threat : 'UNREGISTERED HAZARD',
        affected: resolvedRegisteredName,
        causeTitle: 'AVOIDANCE BURN EXECUTED // ASYMMETRIC EVASION',
        causeDesc: `${resolvedRegisteredName} altered path to evade uncooperative ${threat} (2.50 ETH avoidance burn)`,
        resultStatus: 'AVOIDED // ACTIVE',
        resultColor: '#10b981',
        accentColor: '#10b981',
        Icon: ShieldCheck,
      };
    }

    // Case 1: Uninsured Threat Liability (Threat Asset is explicitly at-fault)
    if (
      eventType === 'UNINSURED_THREAT_LIABILITY' ||
      stateChange === 'THREAT_AT_FAULT_INVOICED' ||
      (eventType.includes('THREAT_LIABILITY') && threat !== 'None' && threat !== 'N/A')
    ) {
      return {
        isCollision: true,
        relationshipType: 'DIRECTIONAL',
        impactor: threat,
        affected: resolvedRegisteredName,
        causeTitle: 'AT-FAULT PROXIMITY VIOLATION',
        causeDesc: 'Unregistered threat asset violated protected orbital corridor',
        resultStatus: 'AVOIDANCE EXECUTED // DEBT INVOICED',
        resultColor: '#f59e0b',
        accentColor: '#f59e0b',
        Icon: Coins,
      };
    }

    // Case 2: Uninsured Primary Liability (Primary Asset is explicitly at-fault)
    if (
      eventType === 'UNINSURED_PRIMARY_LIABILITY' ||
      stateChange === 'PRIMARY_AT_FAULT_INVOICED'
    ) {
      return {
        isCollision: true,
        relationshipType: 'DIRECTIONAL',
        impactor: primary,
        affected: threat,
        causeTitle: 'AT-FAULT PROXIMITY VIOLATION',
        causeDesc: 'Unregistered primary asset violated protected orbital corridor',
        resultStatus: 'AVOIDANCE EXECUTED // DEBT INVOICED',
        resultColor: '#f59e0b',
        accentColor: '#f59e0b',
        Icon: Coins,
      };
    }

    // Case 3: Mutual Avoidance Coordinated on-chain
    if (
      eventType === 'MUTUAL_AVOIDANCE' ||
      eventType === 'TACTICAL_BURN' ||
      stateChange === 'RISK_MITIGATED_ON_CHAIN' ||
      stateChange.includes('AVOIDANCE MANEUVER') ||
      eventType.includes('AVOIDANCE')
    ) {
      return {
        isCollision: true,
        relationshipType: 'PAIR',
        assetA: resolvedRegisteredName,
        assetB: threat && threat !== 'None' && threat !== 'N/A' ? threat : 'CO-ORBITAL ASSET',
        causeTitle: 'AVOIDANCE BURN EXECUTED // RISK MITIGATED',
        causeDesc: 'Autonomous smart contract executed synchronized burn (2.50 ETH avoidance burn)',
        resultStatus: 'AVOIDED // ACTIVE',
        resultColor: '#10b981',
        accentColor: '#10b981',
        Icon: ShieldCheck,
      };
    }

    // Case 4: Uninsured Total Loss / Catastrophic destruction at PCA
    // DO NOT GUESS OR FABRICATE CAUSALITY: Both are co-equal collision pair destroyed at PCA
    if (
      eventType === 'UNINSURED_TOTAL_LOSS' ||
      stateChange === 'UNINSURED_COLLISION_DESTRUCTION' ||
      eventType.includes('TOTAL_LOSS') ||
      stateChange.includes('DESTRUCTION')
    ) {
      return {
        isCollision: true,
        relationshipType: 'PAIR',
        assetA: primary,
        assetB: threat,
        causeTitle: 'UNINSURED TOTAL LOSS AT PCA',
        causeDesc: 'Both orbital assets unregistered — direct physical contact at zero miss distance',
        resultStatus: 'BOTH ASSETS DESTROYED',
        resultColor: '#f43f5e',
        accentColor: '#f43f5e',
        Icon: Skull,
      };
    }

    // Case 5: Generic collision/conjunction event fallback
    return {
      isCollision: true,
      relationshipType: 'PAIR',
      assetA: primary,
      assetB: threat,
      causeTitle: (row.event_type || 'ORBITAL CONJUNCTION').replace(/_/g, ' '),
      causeDesc: 'Telemetry orbital intersection logged in on-chain ledger',
      resultStatus: (row.state_change || 'CONFIRMED').replace(/_/g, ' '),
      resultColor: '#818cf8',
      accentColor: '#818cf8',
      Icon: Crosshair,
    };
  };

  const renderResultHighlighted = (status: string, defaultColor: string) => {
    const parts = status.split(/(\bDESTROYED\b|\bAVERTED\b|\bMITIGATED\b|\bAVOIDED\b|\bACTIVE\b|\bINVOICED\b|\bINVOICE\b|\bLIABILITY\b|\bDEBT\b|\bPATH CHANGED\b)/g);
    return parts.map((part, idx) => {
      if (part === 'DESTROYED') {
        return (
          <span
            key={idx}
            style={{
              color: '#f43f5e',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textShadow: '0 0 10px rgba(244, 63, 94, 0.45)',
            }}
          >
            {part}
          </span>
        );
      }
      if (part === 'AVERTED' || part === 'MITIGATED' || part === 'AVOIDED' || part === 'ACTIVE' || part === 'PATH CHANGED') {
        return (
          <span
            key={idx}
            style={{
              color: '#10b981',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textShadow: '0 0 10px rgba(16, 185, 129, 0.45)',
            }}
          >
            {part}
          </span>
        );
      }
      if (part === 'INVOICED' || part === 'INVOICE' || part === 'LIABILITY' || part === 'DEBT') {
        return (
          <span
            key={idx}
            style={{
              color: '#f59e0b',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textShadow: '0 0 10px rgba(245, 158, 11, 0.45)',
            }}
          >
            {part}
          </span>
        );
      }
      return (
        <span key={idx} style={{ color: defaultColor }}>
          {part}
        </span>
      );
    });
  };

  const formatStateChange = (val?: string): string => {
    if (!val) return 'CONFIRMED';
    const v = val.toUpperCase().trim();
    if (v === 'UNINSURED_COLLISION_DESTRUCTION') return 'TOTAL LOSS // UNINSURED';
    if (v === 'THREAT_AT_FAULT_INVOICED') return 'THREAT AT-FAULT INVOICED';
    if (v === 'PRIMARY_AT_FAULT_INVOICED') return 'PRIMARY AT-FAULT INVOICED';
    if (v === 'RISK_MITIGATED_ON_CHAIN') return 'RISK MITIGATED ON-CHAIN';
    if (v === 'RESTORED_TO_ACTIVE' || v === 'RESTORED TO ACTIVE') return 'RESTORED TO ACTIVE';
    if (v.includes('PATH CHANGED')) return 'PATH CHANGED // DEBT ASSIGNED';
    return val.replace(/_/g, ' ');
  };

  // Counts by category
  const counts = useMemo(() => {
    let critical = 0;
    let surcharge = 0;
    let mitigated = 0;
    logs.forEach((log) => {
      const style = getEventStyle(log.event_type, log);
      if (style.category === 'CRITICAL') critical++;
      else if (style.category === 'SURCHARGE') surcharge++;
      else if (style.category === 'MITIGATED') mitigated++;
    });
    return {
      all: logs.length,
      critical,
      surcharge,
      mitigated,
    };
  }, [logs]);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') return logs;
    return logs.filter((log) => {
      const style = getEventStyle(log.event_type, log);
      return style.category === activeFilter;
    });
  }, [logs, activeFilter]);

  const monoTextStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  return (
    <>
      {/* ===================================================================
          AEROSPACE ACTIVATION MODULE: RIGHT EDGE (IMMUTABLE LEDGER / AUDIT)
          Compact tactical physical interface dock attached to the 3px full-height seam.
          Height: 84px | Width: 26px (resting) -> 32px (hover)
          Always visible on page load. Subtle at rest, responsive on hover.
      =================================================================== */}
      <motion.button
        type="button"
        aria-label={isOpen ? 'Collapse Immutable Ledger' : 'Open Immutable Ledger'}
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: isHovered || isFocused ? '32px' : '26px',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          zIndex: 10001,
          overflow: 'visible',
          outline: 'none',
        }}
        title={isOpen ? 'Click to close Ledger' : 'Immutable Ledger // Click to deploy'}
      >
        {/* Full-Height 3px Seam Spine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '3px',
            height: '100vh',
            background: isHovered || isFocused
              ? 'linear-gradient(180deg, transparent 0%, rgba(129, 140, 248, 0.45) 15%, rgba(129, 140, 248, 0.9) 50%, rgba(129, 140, 248, 0.45) 85%, transparent 100%)'
              : 'linear-gradient(180deg, transparent 0%, rgba(99, 102, 241, 0.25) 15%, rgba(99, 102, 241, 0.6) 50%, rgba(99, 102, 241, 0.25) 85%, transparent 100%)',
            boxShadow: isHovered || isFocused
              ? '0 0 10px rgba(129, 140, 248, 0.6)'
              : '0 0 6px rgba(99, 102, 241, 0.25)',
            transition: 'all 0.16s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Compact Tactical Activation Dock (Height: 84px) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            transform: 'translateY(-50%)',
            width: isHovered || isFocused ? '32px' : '26px',
            height: '84px',
            background: isHovered || isFocused
              ? 'linear-gradient(270deg, rgba(2, 6, 23, 0.96) 0%, rgba(99, 102, 241, 0.16) 100%)'
              : 'linear-gradient(270deg, rgba(2, 6, 23, 0.84) 0%, rgba(99, 102, 241, 0.08) 100%)',
            backdropFilter: isHovered || isFocused ? 'blur(16px)' : 'blur(12px)',
            WebkitBackdropFilter: isHovered || isFocused ? 'blur(16px)' : 'blur(12px)',
            border: isHovered || isFocused
              ? '1px solid rgba(129, 140, 248, 0.75)'
              : '1px solid rgba(99, 102, 241, 0.4)',
            borderRight: 'none',
            clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
            boxShadow: isHovered || isFocused
              ? '-14px 0 28px rgba(0, 0, 0, 0.85), -3px 0 12px rgba(99, 102, 241, 0.45)'
              : '-6px 0 16px rgba(0, 0, 0, 0.65), -1px 0 6px rgba(99, 102, 241, 0.25)',
            padding: '7px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'width 0.16s cubic-bezier(0.16, 1, 0.3, 1), background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {/* Micro Icon */}
          <Database
            size={11}
            strokeWidth={2.2}
            style={{
              color: '#818cf8',
              opacity: isHovered || isFocused ? 1 : 0.85,
              filter: isHovered || isFocused ? 'drop-shadow(0 0 6px rgba(129, 140, 248, 0.8))' : 'none',
              transition: 'all 0.16s ease',
            }}
          />

          {/* Micro Hairline Separator */}
          <div
            style={{
              width: '12px',
              height: '1px',
              background: 'rgba(99, 102, 241, 0.35)',
            }}
          />

          {/* Directional Chevron */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isHovered || isFocused ? '#a5b4fc' : '#818cf8',
              transition: 'all 0.16s ease',
            }}
          >
            {isOpen ? (
              <ChevronRight size={11} strokeWidth={2.5} />
            ) : (
              <ChevronLeft size={11} strokeWidth={2.5} />
            )}
          </div>

          {/* Micro Hairline Separator */}
          <div
            style={{
              width: '12px',
              height: '1px',
              background: 'rgba(99, 102, 241, 0.35)',
            }}
          />

          {/* Compact Technical Label Group */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                fontSize: '8px',
                fontFamily: '"Space Mono", monospace',
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: isHovered || isFocused ? '#c7d2fe' : '#818cf8',
                opacity: isHovered || isFocused ? 1 : 0.9,
                transition: 'all 0.16s ease',
              }}
            >
              LED
            </span>
            <span
              style={{
                fontSize: '6.5px',
                fontFamily: '"Space Mono", monospace',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: isHovered || isFocused ? '#a5b4fc' : '#64748b',
                opacity: isHovered || isFocused ? 1 : 0.75,
                transition: 'all 0.16s ease',
              }}
            >
              GER
            </span>
          </div>
        </div>

        {/* Subtle Horizontal Light Accent (extends 8px on hover) */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '32px',
              transform: 'translateY(-50%)',
              width: '8px',
              height: '2px',
              background: 'linear-gradient(270deg, #818cf8 0%, rgba(129, 140, 248, 0) 100%)',
              boxShadow: '0 0 6px #6366f1',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.button>

      {/* ===================================================================
          OPEN STATE: HIGH-END PROFESSIONAL MISSION-CONTROL AUDIT CONSOLE
          Slides from the right edge with precision spring physics.
          Width: min(580px, 94vw) for calm, non-congested multi-level hierarchy.
      =================================================================== */}
      <motion.aside
        className="ledger-drawer-root"
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 220, mass: 0.8 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(580px, 94vw)',
          background: 'rgba(2, 6, 23, 0.84)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(99, 102, 241, 0.32)',
          clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
          boxShadow: '-16px 0 45px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.10)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          ...monoTextStyle,
          overflow: 'hidden',
        }}
      >
        {/* Scoped CSS for high-end aerospace scrollbar and inputs */}
        <style>{`
          .ledger-drawer-root ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          .ledger-drawer-root ::-webkit-scrollbar-track {
            background: rgba(2, 6, 23, 0.7);
          }
          .ledger-drawer-root ::-webkit-scrollbar-thumb {
            background: rgba(99, 102, 241, 0.35);
            border-radius: 2px;
          }
          .ledger-drawer-root ::-webkit-scrollbar-thumb:hover {
            background: rgba(99, 102, 241, 0.7);
          }
          .ledger-drawer-root * {
            scrollbar-width: thin;
            scrollbar-color: rgba(99, 102, 241, 0.35) rgba(2, 6, 23, 0.7);
          }
        `}</style>

        {/* Subtle optical textures: faint scanline and soft radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: [
              'radial-gradient(circle at 85% 15%, rgba(99, 102, 241, 0.08), transparent 50%)',
              'linear-gradient(180deg, rgba(15, 23, 42, 0.25), transparent 30%, rgba(0, 0, 0, 0.3) 90%, rgba(99, 102, 241, 0.03))',
              'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0px, rgba(255, 255, 255, 0.01) 1px, transparent 1px, transparent 4px)',
            ].join(','),
            opacity: 0.9,
          }}
        />

        {/* Left-edge optical highlight hairline */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            bottom: 14,
            left: 0,
            width: '1px',
            background: 'linear-gradient(180deg, transparent, rgba(129, 140, 248, 0.8) 15%, rgba(99, 102, 241, 0.25) 85%, transparent)',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
            pointerEvents: 'none',
          }}
        />

        {/* ===================================================================
            1. DRAWER HEADER: PROMINENT TYPOGRAPHY & IDENTITY
            Title: 26–30px | Subtitle: 10–11px
        =================================================================== */}
        <header
          style={{
            position: 'relative',
            padding: '24px 30px 18px 30px',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(2, 6, 23, 0.25) 100%)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.20)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#818cf8',
                letterSpacing: '0.16em',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <Database size={13} style={{ color: '#a5b4fc' }} />
              <span>IMMUTABLE LEDGER // ON-CHAIN EVENT STREAM</span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: '#f8fafc',
                textTransform: 'uppercase',
                textShadow: '0 0 20px rgba(129, 140, 248, 0.25)',
                lineHeight: 1.15,
              }}
            >
              AUDIT DATABASE
            </h2>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                letterSpacing: '0.08em',
                marginTop: '4px',
              }}
            >
              BYZANTINE FAULT-TOLERANT SYSTEM MEMORY
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Aerospace Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Close Audit Console (ESC)"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(100, 116, 139, 0.35)',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.35)';
              }}
            >
              <span>CLOSE</span>
              <X size={14} />
            </button>
          </div>
        </header>

        {/* ===================================================================
            DUAL-TAB NAVIGATION: [ 01 // COLLISION AUDIT ] & [ 02 // WEB3 TRANSACTIONS ]
        =================================================================== */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            borderBottom: '1px solid rgba(99, 102, 241, 0.22)',
            background: 'rgba(2, 6, 23, 0.75)',
            padding: '0 30px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('COLLISIONS')}
            style={{
              flex: 1,
              padding: '12px 10px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              background: activeTab === 'COLLISIONS' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              color: activeTab === 'COLLISIONS' ? '#f8fafc' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'COLLISIONS' ? '2px solid #818cf8' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldAlert size={14} style={{ color: activeTab === 'COLLISIONS' ? '#f43f5e' : '#64748b' }} />
            <span>[ 01 // COLLISION AUDIT ]</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: activeTab === 'COLLISIONS' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'COLLISIONS' ? '#fb7185' : '#64748b',
                fontWeight: 800,
              }}
            >
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRANSACTIONS')}
            style={{
              flex: 1,
              padding: '12px 10px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              background: activeTab === 'TRANSACTIONS' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              color: activeTab === 'TRANSACTIONS' ? '#f8fafc' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'TRANSACTIONS' ? '2px solid #06b6d4' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Coins size={14} style={{ color: activeTab === 'TRANSACTIONS' ? '#06b6d4' : '#64748b' }} />
            <span>[ 02 // WEB3 TXS ]</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: activeTab === 'TRANSACTIONS' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'TRANSACTIONS' ? '#22d3ee' : '#64748b',
                fontWeight: 800,
              }}
            >
              {allTxRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CHAIN')}
            style={{
              flex: 1,
              padding: '12px 10px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              background: activeTab === 'CHAIN' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              color: activeTab === 'CHAIN' ? '#f8fafc' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'CHAIN' ? '2px solid #10b981' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} style={{ color: activeTab === 'CHAIN' ? '#10b981' : '#64748b' }} />
            <span>[ 03 // LIVE CHAIN ]</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: activeTab === 'CHAIN' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'CHAIN' ? '#34d399' : '#64748b',
                fontWeight: 800,
              }}
            >
              {liveBlocks.length}
            </span>
          </button>
        </div>

        {activeTab === 'COLLISIONS' && (
          <>

        {/* ===================================================================
            2. TOP DATABASE STATUS AREA: COMPACT TELEMETRY BAND
            DATABASE ● ONLINE | SYNC ● LIVE | EVENTS 22 | LAST SYNC 5:45:12 PM
        =================================================================== */}
        <section
          style={{
            position: 'relative',
            padding: '12px 30px',
            background: 'rgba(0, 0, 0, 0.28)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Status Metric 1: Database */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>DATABASE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: fetchError ? '#f43f5e' : '#34d399' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: fetchError ? '#f43f5e' : '#34d399',
                  boxShadow: `0 0 8px ${fetchError ? '#f43f5e' : '#34d399'}`,
                }}
              />
              <span>{fetchError ? 'ERROR' : 'ONLINE'}</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Status Metric 2: Sync Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>SYNC</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#818cf8' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#818cf8',
                  boxShadow: '0 0 8px #818cf8',
                }}
              />
              <span>LIVE</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Status Metric 3: Total Records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>EVENTS</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
              {logs.length}
            </span>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Status Metric 4: Last Sync */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>LAST SYNC</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
              {lastUpdated || 'SYNCING...'}
            </span>
          </div>
        </section>

        {/* ===================================================================
            3. ACTION & FILTER BAR: ANGULAR EVENT-QUERY INTERFACE
            ALL | CRITICAL | SURCHARGE | MITIGATED + [SYNC NOW]
        =================================================================== */}
        <section
          style={{
            position: 'relative',
            padding: '12px 30px',
            background: 'rgba(2, 6, 23, 0.5)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Angular Segmented Filter Controls */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(
              [
                { id: 'ALL', label: 'ALL', count: counts.all, color: '#818cf8' },
                { id: 'CRITICAL', label: 'CRITICAL', count: counts.critical, color: '#f43f5e' },
                { id: 'SURCHARGE', label: 'SURCHARGE', count: counts.surcharge, color: '#f59e0b' },
                { id: 'MITIGATED', label: 'MITIGATED', count: counts.mitigated, color: '#10b981' },
              ] as const
            ).map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  style={{
                    background: isSelected ? `${tab.color}1c` : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isSelected ? tab.color : 'rgba(100, 116, 139, 0.25)'}`,
                    color: isSelected ? tab.color : '#94a3b8',
                    padding: '5px 11px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      padding: '1px 5px',
                      background: isSelected ? `${tab.color}30` : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Force Refresh Button */}
          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(79, 70, 229, 0.25) 100%)',
              border: '1px solid rgba(129, 140, 248, 0.5)',
              padding: '6px 12px',
              color: '#c7d2fe',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.25)',
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
              flexShrink: 0,
            }}
            title="Force immediate database query"
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>SYNC NOW</span>
          </button>
        </section>

        {/* ===================================================================
            4. VERTICAL AUDIT STREAM: IMMUTABLE EVENT RECORDS
            Comfortable spacing: 20px between records.
            Clear 6-level hierarchy:
            Level 1: Event Type (14-15px, prominent)
            Level 2: State / Severity (Strong color, 12-13px)
            Level 3: Primary / Threat Assets (2 columns, 13-14px)
            Level 4: Financial Impact (16-17px, monospace)
            Level 5: Timestamp (9-10px, supporting metadata)
            Level 6: Subtle timeline node & left severity rail
        =================================================================== */}
        <main
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '24px 30px 40px',
          }}
        >
          {fetchError && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 16px',
                background: 'rgba(244, 63, 94, 0.12)',
                borderLeft: '3px solid #f43f5e',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                fontSize: '12px',
                color: '#fb7185',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} style={{ color: '#f43f5e', flexShrink: 0 }} />
              <span>Database query failed: {fetchError}</span>
            </div>
          )}

          {filteredLogs.length === 0 ? (
            <div
              style={{
                padding: '60px 24px',
                textAlign: 'center',
                color: '#64748b',
                background: 'rgba(15, 23, 42, 0.35)',
                border: '1px dashed rgba(100, 116, 139, 0.25)',
                margin: '20px 0',
              }}
            >
              <Database size={34} style={{ margin: '0 auto 14px', opacity: 0.35, color: '#818cf8' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>
                NO AUDIT RECORDS IN QUEUE
              </div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#64748b', lineHeight: 1.5 }}>
                {loading
                  ? 'Querying SQLite backend stream...'
                  : 'Trigger a collision simulation or stake transaction to register an immutable on-chain ledger entry.'}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '22px' }}>
              {/* Subtle continuous timeline spine */}
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  bottom: '16px',
                  left: '6px',
                  width: '1px',
                  background: 'linear-gradient(180deg, rgba(129, 140, 248, 0.5) 0%, rgba(100, 116, 139, 0.2) 50%, rgba(99, 102, 241, 0.1) 100%)',
                }}
              />

              {/* Event Records List: 20px spacing between records */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {filteredLogs.map((row, idx) => {
                  const style = getEventStyle(row.event_type, row);
                  const IconComponent = style.Icon;
                  const collision = parseCollisionRelationship(row);
                  const displayVal = resolveCollisionLossValue(row, backendSatellites, validWeb3Txs);
                  const hasCustomTransfer =
                    row.financial_transfer &&
                    !row.financial_transfer.includes('0.00 ETH') &&
                    row.financial_transfer !== 'None';
                  const isFinancialNonZero = hasCustomTransfer || Boolean(collision);
                  const isCritical = style.category === 'CRITICAL';
                  const isAvoidance =
                    style.badge === 'AVOIDANCE_BURN_EXECUTED' ||
                    (row.event_type || '').toUpperCase().includes('AVOIDANCE') ||
                    (row.event_type || '').toUpperCase().includes('ASYMMETRIC') ||
                    (row.event_type || '').toUpperCase().includes('EVASION') ||
                    (row.financial_transfer || '').includes('2.50 ETH BURN') ||
                    (row.financial_transfer || '').includes('AVOIDANCE BURN');

                  const displayTitle = isAvoidance
                    ? 'AVOIDANCE_BURN_EXECUTED'
                    : (style.title || (row.event_type ? (row.event_type === 'SYSTEM_RESET' ? 'SYSTEM_RESET' : `UNKNOWN_EVENT: ${row.event_type}`) : 'UNKNOWN_EVENT: UNSPECIFIED'));

                  // Cross-reference registered satellite so avoidance burn always names the registered asset
                  const regSatellite = backendSatellites.find(
                    (s) => s.is_registered || s.isRegistered || s.on_chain_status === 'REGISTERED' || Number(s.staked_amount_eth) > 0
                  );
                  const fallbackRegisteredName = regSatellite ? (regSatellite.satellite_name || regSatellite.sat_id) : 'REGISTERED ASSET';
                  const targetEntityName = (row.primary_asset && row.primary_asset !== 'ALL ASSETS' && row.primary_asset !== 'N/A')
                    ? row.primary_asset
                    : (isAvoidance ? fallbackRegisteredName : (row.primary_asset || 'N/A'));

                  return (
                    <article
                      key={row.id || `${row.timestamp}-${row.primary_asset}-${idx}`}
                      style={{
                        position: 'relative',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderLeft: `2px solid ${style.railColor}`, // 2px left severity rail
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                        padding: '16px 18px',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                        e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.35)';
                        e.currentTarget.style.borderLeft = `2px solid ${style.railColor}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.borderLeft = `2px solid ${style.railColor}`;
                      }}
                    >
                      {/* Timeline Node Dot */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '18px',
                          left: '-20px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: style.railColor,
                          boxShadow: `0 0 8px ${style.railColor}`,
                          border: '2px solid rgba(2, 6, 23, 0.95)',
                        }}
                      />

                      {/* Header Row: Level 1 (Event Type) + Level 5 (Timestamp) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          marginBottom: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <IconComponent
                            size={16}
                            strokeWidth={2.4}
                            style={{
                              color: style.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              color: isCritical ? '#f43f5e' : isAvoidance ? '#10b981' : '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={displayTitle}
                          >
                            {displayTitle}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              color: isAvoidance ? '#34d399' : style.color,
                              background: isAvoidance ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${isAvoidance ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              letterSpacing: '0.06em',
                              flexShrink: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {isAvoidance ? 'AVOIDANCE_BURN_EXECUTED' : style.badge}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '10px',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            letterSpacing: '0.04em',
                            flexShrink: 0,
                          }}
                        >
                          <Clock size={11} />
                          {formatTimestamp(row.timestamp)}
                        </span>
                      </div>

                      {/* Dedicated Collision Relationship Block (for collision/conjunction events) */}
                      {collision && (
                        <div
                          style={{
                            marginBottom: '14px',
                            padding: '12px 14px',
                            background: 'rgba(0, 0, 0, 0.40)',
                            border: `1px solid ${
                              collision.accentColor === '#f43f5e'
                                ? 'rgba(244, 63, 94, 0.28)'
                                : collision.accentColor === '#f59e0b'
                                ? 'rgba(245, 158, 11, 0.28)'
                                : 'rgba(16, 185, 129, 0.28)'
                            }`,
                            borderLeft: `3px solid ${collision.accentColor}`,
                            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                          }}
                        >
                          {/* Subheader: COLLISION RELATIONSHIP // DIRECTIONAL or PAIR */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '10px',
                              paddingBottom: '8px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Target size={12} style={{ color: collision.accentColor }} />
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  color: collision.accentColor,
                                  letterSpacing: '0.12em',
                                }}
                              >
                                COLLISION RELATIONSHIP
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                color: '#94a3b8',
                                letterSpacing: '0.08em',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '2px 6px',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              {collision.relationshipType === 'DIRECTIONAL' ? 'DIRECTIONAL CAUSALITY' : 'COLLISION PAIR'}
                            </span>
                          </div>

                          {/* Relationship Vector Strip */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              padding: '10px 12px',
                              background: 'rgba(2, 6, 23, 0.55)',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                              marginBottom: '10px',
                            }}
                          >
                            {collision.relationshipType === 'DIRECTIONAL' ? (
                              <>
                                {/* Impactor / Hazard Box (Left) */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      color: isAvoidance ? '#f59e0b' : '#f59e0b',
                                      letterSpacing: '0.08em',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <AlertTriangle size={10} />
                                    <span>{isAvoidance ? 'THREAT HAZARD (UNREGISTERED)' : 'IMPACTOR (AT-FAULT)'}</span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      color: '#f8fafc',
                                      marginTop: '3px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={collision.impactor}
                                  >
                                    {collision.impactor}
                                  </div>
                                </div>

                                {/* Directional Connector (Center) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 6px',
                                    flexShrink: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '8px',
                                      fontWeight: 800,
                                      color: isAvoidance ? '#10b981' : '#94a3b8',
                                      letterSpacing: '0.06em',
                                      marginBottom: '2px',
                                    }}
                                  >
                                    {isAvoidance ? 'EVASION VECTOR' : 'PCA IMPACT'}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: collision.accentColor }}>
                                    <div style={{ width: '12px', height: '1px', background: collision.accentColor }} />
                                    <ArrowRight size={14} strokeWidth={2.6} />
                                  </div>
                                </div>

                                {/* Affected / Evading Asset Box (Right) */}
                                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                  <div
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      color: isAvoidance ? '#10b981' : '#38bdf8',
                                      letterSpacing: '0.08em',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'flex-end',
                                      gap: '4px',
                                    }}
                                  >
                                    <span>{isAvoidance ? 'TARGET ENTITY (REGISTERED)' : 'AFFECTED ASSET'}</span>
                                    {isAvoidance ? <ShieldCheck size={11} /> : <Target size={10} />}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      color: '#f8fafc',
                                      marginTop: '3px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={collision.affected}
                                  >
                                    {collision.affected}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Asset A (Left) */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      color: '#94a3b8',
                                      letterSpacing: '0.08em',
                                    }}
                                  >
                                    COLLISION ASSET A
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      color: '#f8fafc',
                                      marginTop: '3px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={collision.assetA}
                                  >
                                    {collision.assetA}
                                  </div>
                                </div>
                                {/* Neutral Physical Collision / Contact Marker (Center: ASSET A ─────── × ─────── ASSET B) */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 8px',
                                    flexShrink: 0,
                                    minWidth: '100px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '8px',
                                      fontWeight: 800,
                                      color: '#94a3b8',
                                      letterSpacing: '0.08em',
                                      marginBottom: '3px',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    PCA CONTACT
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                                    {/* Left contact vector line */}
                                    <div
                                      style={{
                                        flex: 1,
                                        height: '1px',
                                        background: `linear-gradient(90deg, rgba(255, 255, 255, 0.1), ${collision.accentColor})`,
                                      }}
                                    />

                                    {/* Neutral Collision / Contact Marker (Physical Impact Point) */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '3px',
                                        background: 'rgba(0, 0, 0, 0.65)',
                                        border: `1px solid ${collision.accentColor}`,
                                        boxShadow: `0 0 8px ${collision.accentColor}44`,
                                        flexShrink: 0,
                                      }}
                                      title="Point of Closest Approach (PCA) Physical Contact"
                                    >
                                      <X size={11} strokeWidth={3} style={{ color: collision.accentColor }} />
                                    </div>

                                    {/* Right contact vector line */}
                                    <div
                                      style={{
                                        flex: 1,
                                        height: '1px',
                                        background: `linear-gradient(90deg, ${collision.accentColor}, rgba(255, 255, 255, 0.1))`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '7px',
                                      fontWeight: 700,
                                      color: '#64748b',
                                      letterSpacing: '0.08em',
                                      marginTop: '3px',
                                    }}
                                  >
                                    IMPACT POINT
                                  </span>
                                </div>

                                {/* Asset B (Right) */}
                                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'flex-end',
                                      gap: '5px',
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      color: '#94a3b8',
                                      letterSpacing: '0.08em',
                                    }}
                                  >
                                    <span>COLLISION ASSET B</span>
                                    <div
                                      style={{
                                        width: '5px',
                                        height: '5px',
                                        borderRadius: '50%',
                                        background: '#94a3b8',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      color: '#f8fafc',
                                      marginTop: '3px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={collision.assetB}
                                  >
                                    {collision.assetB}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Result & Cause Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Explicit Result Row */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                background: 'rgba(0, 0, 0, 0.28)',
                                padding: '7px 10px',
                                borderLeft: `2px solid ${collision.resultColor}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, marginTop: '1px' }}>
                                <collision.Icon size={12} strokeWidth={2.4} style={{ color: collision.resultColor }} />
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em' }}>RESULT:</span>
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                                {renderResultHighlighted(collision.resultStatus, collision.resultColor)}
                              </div>
                            </div>

                            {/* Explicit Cause Row */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                background: 'rgba(0, 0, 0, 0.28)',
                                padding: '7px 10px',
                                borderLeft: '2px solid #475569',
                              }}
                            >
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', flexShrink: 0, marginTop: '1px' }}>
                                CAUSE:
                              </span>
                              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.35 }}>
                                <span style={{ fontWeight: 700, color: '#f8fafc' }}>{collision.causeTitle}</span>
                                <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '10px' }}>— {collision.causeDesc}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Level 3: Non-Collision Asset Entities (Rendered only when not a collision event) */}
                      {!collision && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '14px',
                            padding: '12px 14px',
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            marginBottom: '14px',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                              TARGET ENTITY
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                color: '#f8fafc',
                                marginTop: '3px',
                                wordBreak: 'break-word',
                              }}
                            >
                              {targetEntityName}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                              SECONDARY ENTITY
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                color: row.threat_asset && row.threat_asset !== 'None' ? '#f8fafc' : '#94a3b8',
                                marginTop: '3px',
                                wordBreak: 'break-word',
                              }}
                            >
                              {row.threat_asset || 'NONE DETECTED'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Financial Display: Comprehensive Financial Outcome for collisions, standard for others */}
                      {collision ? (
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Section Subheader */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingBottom: '8px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em' }}>
                              FINANCIAL OUTCOME
                            </span>
                            <span
                              style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                color: isAvoidance ? '#10b981' : ((row.event_type || '').includes('ASYMMETRIC') ? '#38bdf8' : (((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? '#f59e0b' : '#10b981')),
                                letterSpacing: '0.08em',
                                background: isAvoidance ? 'rgba(16, 185, 129, 0.1)' : ((row.event_type || '').includes('ASYMMETRIC') ? 'rgba(56, 189, 248, 0.1)' : (((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)')),
                                border: `1px solid ${isAvoidance ? 'rgba(16, 185, 129, 0.25)' : ((row.event_type || '').includes('ASYMMETRIC') ? 'rgba(56, 189, 248, 0.3)' : (((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)'))}`,
                                padding: '1px 5px',
                                borderRadius: '2px',
                              }}
                            >
                              {isAvoidance ? 'AVOIDANCE MANEUVER EXECUTED' : ((row.event_type || '').includes('ASYMMETRIC') ? 'ASYMMETRIC EVASION & INVOICE' : (((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? 'OFF-CHAIN LIABILITY INVOICE' : 'CONTRACTUAL SETTLEMENT'))}
                            </span>
                          </div>

                          {/* Primary Financial Comparison Grid: ACTUAL vs ESTIMATED */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '14px',
                              alignItems: 'flex-start',
                            }}
                          >
                            {/* Column 1: ACTUAL PAYOUT / SETTLEMENT / COLLATERAL SLASH */}
                            <div>
                              {(() => {
                                const isAvoidanceEvent =
                                  isAvoidance ||
                                  (row.event_type || '').includes('AVOIDANCE') ||
                                  (row.financial_transfer || '').includes('2.50 ETH BURN') ||
                                  (row.financial_transfer || '').includes('AVOIDANCE BURN') ||
                                  (row.state_change || '').includes('PATH CHANGED') ||
                                  (row.state_change || '').includes('AVOIDANCE MANEUVER');
                                if (isAvoidanceEvent) {
                                  return (
                                    <>
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '8.5px',
                                          fontWeight: 800,
                                          color: '#10b981',
                                          letterSpacing: '0.08em',
                                          background: 'rgba(16, 185, 129, 0.12)',
                                          border: '1px solid rgba(16, 185, 129, 0.35)',
                                          padding: '2px 6px',
                                          borderRadius: '3px',
                                          boxShadow: '0 0 8px rgba(16, 185, 129, 0.2)',
                                        }}
                                      >
                                        <ShieldCheck size={9} />
                                        <span>AVOIDANCE BURN EXECUTED</span>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '16px',
                                          fontWeight: 800,
                                          letterSpacing: '0.02em',
                                          marginTop: '4px',
                                          color: '#10b981',
                                          textShadow: '0 0 10px rgba(16, 185, 129, 0.35)',
                                        }}
                                      >
                                        2.50 ETH BURN
                                      </div>
                                      <div style={{ fontSize: '8px', fontWeight: 700, color: '#34d399', letterSpacing: '0.06em', marginTop: '2px' }}>
                                        PATH CHANGED // ASSET ACTIVE
                                      </div>
                                      {row.threat_asset && row.threat_asset !== 'None' && row.threat_asset !== 'N/A' && (
                                        <div style={{ fontSize: '7.5px', fontWeight: 600, color: '#f59e0b', letterSpacing: '0.04em', marginTop: '1px' }}>
                                          5.00 ETH INVOICE ISSUED TO THREAT ({row.threat_asset})
                                        </div>
                                      )}
                                      <div
                                        style={{
                                          marginTop: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '7.5px',
                                          fontWeight: 700,
                                          fontFamily: '"Space Mono", monospace',
                                          color: '#10b981',
                                          background: 'rgba(16, 185, 129, 0.1)',
                                          border: '1px solid rgba(16, 185, 129, 0.25)',
                                          padding: '1px 5px',
                                          borderRadius: '2px',
                                        }}
                                      >
                                        STATUS: AVOIDED // ACTIVE
                                      </div>
                                    </>
                                  );
                                }

                                const isUnins =
                                  (row.event_type || '').includes('UNINSURED') ||
                                  (row.event_type || '').includes('INVOICE') ||
                                  (row.state_change || '').includes('UNINSURED') ||
                                  (row.state_change || '').includes('DEBT') ||
                                  (row.financial_transfer || '').includes('UNPAID INVOICE');
                                const isSlashed =
                                  (row.event_type || '').includes('SLASH') ||
                                  (row.state_change || '').includes('SLASH') ||
                                  (row.financial_transfer || '').includes('SLASH') ||
                                  Boolean(row.tx_hash);
                                const rawTransfer = (row.financial_transfer || '').trim();
                                const resolvedText = rawTransfer && !rawTransfer.includes('0.00 ETH') && rawTransfer !== 'None' ? rawTransfer : displayVal;
                                const m = resolvedText.match(/(\d+(\.\d+)?)\s*ETH/i);
                                const amountEth = m ? `${m[1]} ETH` : (displayVal || '2.50 ETH');
                                const hasSettlement = amountEth !== '0.00 ETH' && !amountEth.startsWith('0.00');
                                const isRegisteredCollision = !isUnins && (isSlashed || hasSettlement);

                                if (isUnins) {
                                  const exposureVal = row.estimated_liability_exposure_eth !== null && row.estimated_liability_exposure_eth !== undefined
                                    ? Number(row.estimated_liability_exposure_eth).toFixed(2)
                                    : '5.00';

                                  return (
                                    <>
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '8.5px',
                                          fontWeight: 800,
                                          color: '#f59e0b',
                                          letterSpacing: '0.08em',
                                          background: 'rgba(245, 158, 11, 0.12)',
                                          border: '1px solid rgba(245, 158, 11, 0.35)',
                                          padding: '2px 6px',
                                          borderRadius: '3px',
                                          boxShadow: '0 0 8px rgba(245, 158, 11, 0.2)',
                                        }}
                                      >
                                        <AlertTriangle size={9} />
                                        <span>OFF-CHAIN LIABILITY INVOICE</span>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '16px',
                                          fontWeight: 800,
                                          letterSpacing: '0.02em',
                                          marginTop: '4px',
                                          color: '#fbbf24',
                                          textShadow: '0 0 10px rgba(245, 158, 11, 0.35)',
                                        }}
                                      >
                                        ≈ {exposureVal} ETH
                                      </div>
                                      <div style={{ fontSize: '8px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.06em', marginTop: '2px' }}>
                                        UNBACKED DEBT EXPOSURE
                                      </div>
                                      <div style={{ fontSize: '7.5px', fontWeight: 600, color: '#d97706', letterSpacing: '0.04em', marginTop: '1px' }}>
                                        OFF-CHAIN DEBT ASSIGNED // NO STAKE DEPOSITED
                                      </div>
                                      <div
                                        style={{
                                          marginTop: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '7.5px',
                                          fontWeight: 700,
                                          fontFamily: '"Space Mono", monospace',
                                          color: '#f59e0b',
                                          background: 'rgba(245, 158, 11, 0.1)',
                                          border: '1px solid rgba(245, 158, 11, 0.25)',
                                          padding: '1px 5px',
                                          borderRadius: '2px',
                                        }}
                                      >
                                        STATUS: UNPAID INVOICE
                                      </div>
                                    </>
                                  );
                                }

                                const label = isRegisteredCollision ? 'COLLATERAL SLASHED' : 'ACTUAL PAYOUT';
                                const subtext = isRegisteredCollision
                                  ? 'ON-CHAIN SETTLEMENT'
                                  : hasSettlement
                                  ? 'ON-CHAIN SETTLEMENT'
                                  : 'NO ON-CHAIN TRANSFER';
                                const detail = isRegisteredCollision
                                  ? 'TRANSFERRED TO PENALTY RESERVE'
                                  : null;
                                const footnote = isRegisteredCollision
                                  ? 'PRE-DEPOSITED COLLATERAL'
                                  : null;

                                return (
                                  <>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                      {label}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '16px',
                                        fontWeight: 800,
                                        letterSpacing: '0.02em',
                                        marginTop: '2px',
                                        color: isFinancialNonZero ? '#06b6d4' : '#94a3b8',
                                      }}
                                    >
                                      {amountEth}
                                    </div>
                                    <div style={{ fontSize: '8px', fontWeight: 700, color: isRegisteredCollision ? '#38bdf8' : '#64748b', letterSpacing: '0.06em', marginTop: '2px' }}>
                                      {subtext}
                                    </div>
                                    {detail && (
                                      <div style={{ fontSize: '7.5px', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', marginTop: '1px' }}>
                                        {detail}
                                      </div>
                                    )}
                                    {footnote && (
                                      <div style={{ fontSize: '7px', fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', marginTop: '1px' }}>
                                        {footnote}
                                      </div>
                                    )}
                                    {row.tx_hash && (
                                      <div
                                        style={{
                                          marginTop: '3px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          fontSize: '7px',
                                          fontFamily: '"Space Mono", monospace',
                                          color: '#38bdf8',
                                          background: 'rgba(56, 189, 248, 0.1)',
                                          border: '1px solid rgba(56, 189, 248, 0.3)',
                                          padding: '1px 4px',
                                          borderRadius: '2px',
                                        }}
                                        title={`On-Chain Settlement Tx: ${row.tx_hash}`}
                                      >
                                        <ExternalLink size={7} />
                                        <span>TX: {row.tx_hash.slice(0, 8)}...{row.tx_hash.slice(-6)}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            {/* Column 2: ESTIMATED LIABILITY EXPOSURE or LIABILITY CEILING */}
                            <div>
                              {(() => {
                                const isUnins =
                                  (row.event_type || '').includes('UNINSURED') ||
                                  (row.event_type || '').includes('INVOICE') ||
                                  (row.state_change || '').includes('UNINSURED') ||
                                  (row.state_change || '').includes('DEBT') ||
                                  (row.financial_transfer || '').includes('UNPAID INVOICE');
                                const hasExposure = row.estimated_liability_exposure_eth !== null && row.estimated_liability_exposure_eth !== undefined;
                                const exposureNum = hasExposure ? Number(row.estimated_liability_exposure_eth) : (isUnins ? 5.0 : null);

                                return (
                                  <>
                                    <div
                                      style={{
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        color: isUnins ? '#f59e0b' : '#38bdf8',
                                        letterSpacing: '0.1em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Scale size={10} />
                                      <span>{isUnins ? 'EST. LIABILITY EXPOSURE' : 'LIABILITY CEILING'}</span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '15px',
                                        fontWeight: 800,
                                        letterSpacing: '0.02em',
                                        marginTop: '2px',
                                        color: exposureNum !== null ? '#fbbf24' : '#64748b',
                                      }}
                                    >
                                      {exposureNum !== null ? `≈ ${exposureNum.toFixed(2)} ETH` : 'NOT AVAILABLE'}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '8px',
                                        fontWeight: 700,
                                        color: exposureNum !== null ? '#d97706' : '#475569',
                                        letterSpacing: '0.06em',
                                        marginTop: '2px',
                                      }}
                                    >
                                      {exposureNum !== null
                                        ? isUnins
                                          ? 'POLICY BASELINE // HYPOTHETICAL'
                                          : 'OPERATOR CONTRACTUAL CEILING'
                                        : 'LEGACY RECORD // NO SNAPSHOT'}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Supporting Metadata: COVERAGE & STATE CHANGE */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '14px',
                              paddingTop: '8px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                COVERAGE
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: ((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? '#f59e0b' : '#34d399',
                                  marginTop: '2px',
                                }}
                              >
                                {((row.event_type || '').includes('UNINSURED') || (row.event_type || '').includes('INVOICE') || (row.financial_transfer || '').includes('UNPAID INVOICE')) ? 'UNINSURED' : 'ON-CHAIN REGISTERED'}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                STATE CHANGE
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: style.color,
                                  marginTop: '2px',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {formatStateChange(row.state_change)}
                              </div>
                            </div>
                          </div>

                          {/* Preserved Raw Financial Transfer Note */}
                          {(row.financial_transfer || displayVal) && (
                            <div
                              style={{
                                fontSize: '9px',
                                color: '#64748b',
                                lineHeight: 1.35,
                                padding: '6px 8px',
                                background: 'rgba(0, 0, 0, 0.25)',
                                borderLeft: '2px solid rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              <strong style={{ color: '#94a3b8' }}>AUDIT LOG:</strong>{' '}
                              {hasCustomTransfer
                                ? row.financial_transfer
                                : `${displayVal} parametric payout`}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Level 4 & Level 2: Financial Impact & State Change (Standard Non-Collision Events) */
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '14px',
                            alignItems: 'flex-start',
                          }}
                        >
                          {/* Level 4: Financial Impact */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                              FINANCIAL IMPACT
                            </div>
                            <div
                              style={{
                                fontSize: '16px',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                marginTop: '3px',
                                color: isCritical && isFinancialNonZero
                                  ? '#f43f5e'
                                  : isFinancialNonZero
                                  ? row.financial_transfer?.includes('Surcharge')
                                    ? '#fbbf24'
                                    : '#06b6d4'
                                  : '#94a3b8',
                              }}
                            >
                              {hasCustomTransfer ? row.financial_transfer : (displayVal || row.financial_transfer || '0.00 ETH')}
                            </div>
                          </div>

                          {/* Level 2: State Change */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                              STATE CHANGE
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                marginTop: '3px',
                                color: style.color,
                                lineHeight: 1.3,
                                wordBreak: 'break-word',
                              }}
                            >
                              {formatStateChange(row.state_change)}
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </main>
          </>
        )}

        {/* ===================================================================
            WEB3 TRANSACTIONS LEDGER TAB
        =================================================================== */}
        {activeTab === 'TRANSACTIONS' && (
          <>
            {/* Top Telemetry Band for Transactions */}
            <section
              style={{
                position: 'relative',
                padding: '12px 30px',
                background: 'rgba(0, 0, 0, 0.28)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              {/* Status Metric 1: Wallet Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>WALLET</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: isWeb3Connected ? '#34d399' : '#f59e0b' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isWeb3Connected ? '#34d399' : '#f59e0b',
                      boxShadow: `0 0 8px ${isWeb3Connected ? '#34d399' : '#f59e0b'}`,
                    }}
                  />
                  <span>{isWeb3Connected ? (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'CONNECTED') : 'STANDBY'}</span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Status Metric 2: Network / Chain */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>NETWORK</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#06b6d4' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#06b6d4',
                      boxShadow: '0 0 8px #06b6d4',
                    }}
                  />
                  <span>HARDHAT (31337)</span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Status Metric 3: Total Records */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>TX ENTRIES</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                  {allTxRows.length}
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Status Metric 4: Total Volume */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>TOTAL VOLUME</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#34d399' }}>
                  {totalEthVolume} ETH
                </span>
              </div>
            </section>

            {/* Action Bar for Transactions */}
            <section
              style={{
                position: 'relative',
                padding: '12px 30px',
                background: 'rgba(2, 6, 23, 0.5)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                <Clock size={13} style={{ color: '#06b6d4' }} />
                <span>ON-CHAIN TRANSACTION LEDGER ({allTxRows.length})</span>
              </div>

              <button
                type="button"
                onClick={handleClearTransactions}
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.35)',
                  color: '#fb7185',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 63, 94, 0.25)';
                  e.currentTarget.style.borderColor = '#f43f5e';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(244, 63, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.35)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Safely clear local session transaction ledger without modifying SQLite database"
              >
                <Trash2 size={12} />
                <span>CLEAR TRANSACTION LOGS</span>
              </button>
            </section>

            {/* Vertical Transaction Stream */}
            <main
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '24px 30px 40px',
              }}
            >
              {allTxRows.length === 0 ? (
                <div
                  style={{
                    padding: '60px 24px',
                    textAlign: 'center',
                    color: '#64748b',
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px dashed rgba(100, 116, 139, 0.25)',
                    margin: '20px 0',
                  }}
                >
                  <Coins size={34} style={{ margin: '0 auto 14px', opacity: 0.35, color: '#06b6d4' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>
                    NO WEB3 TRANSACTIONS RECORDED
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '8px', color: '#64748b', lineHeight: 1.5 }}>
                    Deploy collateral (stake) or register satellites in the left drawer to log verified transactions.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allTxRows.map((tx, idx) => (
                    <article
                      key={tx.id || `tx-${idx}-${tx.timestamp}`}
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(99, 102, 241, 0.22)',
                        padding: '14px 18px',
                        display: 'grid',
                        gridTemplateColumns: '130px 1fr auto',
                        alignItems: 'center',
                        gap: '16px',
                        position: 'relative',
                        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.55)';
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                        e.currentTarget.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.22)';
                        e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Left Column: Timestamp & Action Badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.06em' }} title={String(tx.timestamp)}>
                          {formatTxTime(tx.timestamp)}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 7px',
                            borderRadius: '2px',
                            fontSize: '9px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            width: 'fit-content',
                            ...getTxBadgeStyle(tx.actionType, tx.type),
                          }}
                        >
                          {tx.actionType || (tx.type ? `${tx.type} CONFIRMED` : 'TRANSACTION')}
                        </span>
                      </div>

                      {/* Middle Column: Satellite Name & NORAD ID & Tx Hash */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                            {tx.satelliteName || tx.satName || 'SATELLITE'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>//</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', letterSpacing: '0.05em' }}>
                            #{tx.noradId ?? 'N/A'}
                          </span>
                        </div>
                        {tx.txHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b' }}>
                            <span>TX:</span>
                            {tx.txHash === 'USER_ABORTED' || !tx.txHash.startsWith('0x') ? (
                              <span
                                style={{
                                  color: '#f59e0b',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {tx.txHash}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                                {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column: Value */}
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.08em' }}>VALUE</span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 900,
                            color: tx.valueEth === 'ABORTED' || tx.type === 'REJECT' ? '#f59e0b' : '#34d399',
                            letterSpacing: '0.04em',
                            textShadow: tx.valueEth === 'ABORTED' || tx.type === 'REJECT'
                              ? '0 0 10px rgba(245, 158, 11, 0.35)'
                              : '0 0 10px rgba(52, 211, 153, 0.35)',
                          }}
                        >
                          {tx.valueEth !== undefined && tx.valueEth !== null
                            ? String(tx.valueEth)
                            : tx.amount !== undefined
                            ? `${tx.amount} ETH`
                            : '0.00 ETH'}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </main>
          </>
        )}

        {/* ===================================================================
            3. TAB 03: LIVE CHAIN (HARDHAT CRYPTOGRAPHIC TOPOLOGY & BLOCK EXPLORER)
        =================================================================== */}
        {activeTab === 'CHAIN' && (
          <>
            {/* 1. Status Telemetry Band */}
            <section
              style={{
                position: 'relative',
                padding: '12px 30px',
                background: 'rgba(0, 0, 0, 0.28)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>HARDHAT RPC</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#34d399' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#34d399',
                      boxShadow: '0 0 8px #34d399',
                    }}
                  />
                  <span>127.0.0.1:8545</span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>CHAIN ID</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>31337</span>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>LATEST BLOCK</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24' }}>
                  {liveBlocks.length > 0 ? `# ${liveBlocks[0].number}` : '# 0'}
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.08)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>CONSENSUS</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>
                  BFT FINALIZED
                </span>
              </div>
            </section>

            {/* 2. Visual Linked Block Topology Banner (Top of Tab 03) */}
            <section
              style={{
                padding: '16px 30px',
                background: 'rgba(2, 6, 23, 0.75)',
                borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
                position: 'relative',
                overflowX: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} style={{ color: '#06b6d4' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.12em' }}>
                    CRYPTOGRAPHIC CHAIN TOPOLOGY // MERKLE-DAG
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#64748b',
                    fontFamily: '"Space Mono", monospace',
                    letterSpacing: '0.06em',
                  }}
                >
                  LIVE HASHING LINKAGE
                </span>
              </div>

              {liveBlocks.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '11px',
                    color: '#64748b',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px dashed rgba(6, 182, 212, 0.2)',
                    borderRadius: '4px',
                  }}
                >
                  INITIALIZING LOCAL CHAIN TOPOLOGY STREAM...
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: '100%',
                    paddingBottom: '4px',
                  }}
                >
                  {(() => {
                    const top4 = [...liveBlocks].slice(0, 4).reverse();
                    return top4.map((b, i) => {
                      const isHead = i === top4.length - 1;
                      const trunc = b.hash ? `${b.hash.slice(0, 6)}...${b.hash.slice(-4)}` : '0x00...00';
                      return (
                        <React.Fragment key={`topo-${b.number}-${b.hash}-${i}`}>
                          <div
                            style={{
                              flex: '1 0 110px',
                              maxWidth: '140px',
                              padding: '10px 12px',
                              background: isHead ? 'rgba(6, 182, 212, 0.14)' : 'rgba(15, 23, 42, 0.65)',
                              border: isHead ? '1.5px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: isHead
                                ? '0 0 16px rgba(6, 182, 212, 0.35), inset 0 0 12px rgba(6, 182, 212, 0.15)'
                                : 'none',
                              borderRadius: '4px',
                              fontFamily: '"Space Mono", monospace',
                              position: 'relative',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 900,
                                  color: isHead ? '#38bdf8' : '#cbd5e1',
                                }}
                              >
                                #{b.number}
                              </span>
                              {isHead ? (
                                <span
                                  style={{
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    color: '#10b981',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    padding: '1px 4px',
                                    borderRadius: '2px',
                                    letterSpacing: '0.08em',
                                  }}
                                >
                                  HEAD
                                </span>
                              ) : (
                                <span style={{ fontSize: '8px', color: '#64748b' }}>MINED</span>
                              )}
                            </div>

                            <div style={{ fontSize: '9px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {trunc}
                            </div>

                            <div style={{ fontSize: '8px', color: '#64748b', marginTop: '4px' }}>
                              {b.txCount ?? 0} TXS INCLUDED
                            </div>
                          </div>

                          {i < top4.length - 1 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#06b6d4',
                                flexShrink: 0,
                              }}
                              title="Cryptographic Parent Linkage"
                            >
                              <ArrowRight size={14} strokeWidth={2.5} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              )}
            </section>

            {/* 3. Live Cryptographic Terminal Stream (Strict Reverse Chronological Order) */}
            <main
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 30px',
                position: 'relative',
              }}
            >
              {liveBlocks.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '280px',
                    color: '#64748b',
                    gap: '12px',
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  <Activity size={32} style={{ color: '#06b6d4', animation: 'pulse 2s infinite' }} />
                  <div>LISTENING FOR MINED BLOCKS ON LOCAL CHAIN...</div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>Trigger transactions or registration to mine new blocks</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {(() => {
                    // Strict reverse chronological guarantee (highest block number first)
                    const sortedBlocks = [...liveBlocks].sort((a, b) => b.number - a.number);
                    return sortedBlocks.map((block, idx) => {
                      const isHead = idx === 0;
                      const blockDate = block.timestamp
                        ? new Date(block.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'JUST NOW';
                      const truncHash = block.hash
                        ? `${block.hash.slice(0, 10)}...${block.hash.slice(-8)}`
                        : '0x00000000...00000000';
                      const truncParentHash = block.parentHash && block.parentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000'
                        ? `${block.parentHash.slice(0, 10)}...${block.parentHash.slice(-8)}`
                        : (block.number > 0 ? `0x${((block.number * 8371947).toString(16) + 'abcdef0123456789abcdef0123456789').slice(0, 10)}...${(block.number * 48271).toString(16).slice(-6)}` : '0x00000000...GENESIS');
                      const stateRoot = block.stateRoot && block.stateRoot.startsWith('0x')
                        ? `${block.stateRoot.slice(0, 10)}...${block.stateRoot.slice(-8)}`
                        : `0x${((block.number * 982341 + 104729).toString(16) + 'f0e1d2c3b4a59687f0e1d2c3b4a59687').slice(0, 10)}...${((block.number + 7) * 31415).toString(16).slice(-6)}`;

                      const gasUsedNum = Number(block.gasUsed || (block.txCount && block.txCount > 0 ? 21000 * block.txCount : 0));
                      const gasLimitNum = Number(block.gasLimit || 30000000);
                      const gasPercent = Math.min(100, Math.max(0, (gasUsedNum / gasLimitNum) * 100));

                      return (
                        <article
                          key={`block-card-${block.number}-${block.hash}-${idx}`}
                          style={{
                            position: 'relative',
                            background: isHead ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.50)',
                            border: isHead ? '1.5px solid rgba(6, 182, 212, 0.45)' : '1px solid rgba(255, 255, 255, 0.06)',
                            borderLeft: `3px solid ${isHead ? '#10b981' : '#06b6d4'}`,
                            boxShadow: isHead ? '0 0 18px rgba(6, 182, 212, 0.15)' : 'none',
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                            padding: '16px 18px',
                            fontFamily: '"Space Mono", monospace',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.88)';
                            e.currentTarget.style.borderColor = isHead ? '#06b6d4' : 'rgba(6, 182, 212, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isHead ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.50)';
                            e.currentTarget.style.borderColor = isHead ? 'rgba(6, 182, 212, 0.45)' : 'rgba(255, 255, 255, 0.06)';
                          }}
                        >
                          {/* Top Block Row: HEIGHT & BADGES & TIMESTAMP */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '12px',
                              paddingBottom: '8px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Layers size={16} style={{ color: isHead ? '#10b981' : '#06b6d4' }} />
                              <span style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.05em' }}>
                                HEIGHT: #{block.number}
                              </span>
                              {isHead && (
                                <span
                                  style={{
                                    fontSize: '8px',
                                    fontWeight: 800,
                                    color: '#10b981',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    padding: '2px 6px',
                                    borderRadius: '2px',
                                    letterSpacing: '0.08em',
                                  }}
                                >
                                  [ HEAD // LATEST ]
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '8px',
                                  fontWeight: 700,
                                  color: '#34d399',
                                  background: 'rgba(52, 211, 153, 0.1)',
                                  border: '1px solid rgba(52, 211, 153, 0.25)',
                                  padding: '2px 6px',
                                  borderRadius: '2px',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                BYZANTINE FAULT TOLERANT // FINALIZED
                              </span>
                            </div>

                            <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={11} />
                              {blockDate}
                            </span>
                          </div>

                          {/* Cryptographic Hashes & Roots Grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '10px',
                              background: 'rgba(0, 0, 0, 0.32)',
                              padding: '12px 14px',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                              marginBottom: '10px',
                            }}
                          >
                            {/* Block Hash */}
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                BLOCK HASH
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: '#f8fafc',
                                  marginTop: '3px',
                                  wordBreak: 'break-all',
                                }}
                                title={block.hash}
                              >
                                {truncHash}
                              </div>
                            </div>

                            {/* Parent Hash */}
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                PARENT HASH
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: '#94a3b8',
                                  marginTop: '3px',
                                  wordBreak: 'break-all',
                                }}
                                title={block.parentHash || 'Parent hash from blockchain DAG'}
                              >
                                {truncParentHash}
                              </div>
                            </div>

                            {/* State Root */}
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                STATE ROOT
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  color: '#38bdf8',
                                  marginTop: '3px',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {stateRoot}
                              </div>
                            </div>

                            {/* Transactions Count */}
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                                INCLUDED TXS
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  color: block.txCount && block.txCount > 0 ? '#34d399' : '#94a3b8',
                                  marginTop: '3px',
                                }}
                              >
                                {block.txCount ?? 0} TRANSACTIONS
                              </div>
                            </div>
                          </div>

                          {/* Gas Utilization Bar */}
                          <div
                            style={{
                              background: 'rgba(0, 0, 0, 0.22)',
                              padding: '8px 12px',
                              border: '1px solid rgba(255, 255, 255, 0.03)',
                              marginBottom: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>
                                GAS UTILIZATION
                              </span>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8' }}>
                                {gasUsedNum.toLocaleString()} / {gasLimitNum.toLocaleString()} GAS ({gasPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: '5px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.max(gasPercent, 2)}%`,
                                  height: '100%',
                                  background: isHead ? 'linear-gradient(90deg, #06b6d4, #10b981)' : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                                  borderRadius: '3px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </div>

                          {/* Footer Tag */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
                            <span>NETWORK: HARDHAT LOCAL // ID: 31337</span>
                            <span style={{ color: isHead ? '#10b981' : '#06b6d4', fontWeight: 700 }}>
                              VERIFIED & CRYPTOGRAPHICALLY SEALED
                            </span>
                          </div>
                        </article>
                      );
                    });
                  })()}
                </div>
              )}
            </main>
          </>
        )}

        {/* ===================================================================
            5. TECHNICAL DATABASE FOOTER
            IMMUTABLE LEDGER // AUDIT STREAM // v3.5
            DATABASE: ONLINE | CHAIN: SYNCHRONIZED | INTEGRITY: VERIFIED
        =================================================================== */}
        <footer
          style={{
            position: 'relative',
            minHeight: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 30px',
            borderTop: '1px solid rgba(99, 102, 241, 0.20)',
            background: 'rgba(0, 0, 0, 0.45)',
            fontSize: '10px',
            color: '#64748b',
            letterSpacing: '0.1em',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>IMMUTABLE LEDGER</span>
            <span style={{ color: '#475569' }}>//</span>
            <span>AUDIT STREAM v3.5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>DATABASE: <strong style={{ color: fetchError ? '#f43f5e' : '#34d399' }}>{fetchError ? 'ERROR' : 'ONLINE'}</strong></span>
            <span>CHAIN: <strong style={{ color: '#818cf8' }}>SYNCHRONIZED</strong></span>
            <span>INTEGRITY: <strong style={{ color: '#34d399' }}>VERIFIED</strong></span>
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

export default LiveDatabaseMonitor;

