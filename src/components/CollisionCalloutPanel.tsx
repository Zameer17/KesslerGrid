import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Coins,
  Minimize2,
  Maximize2,
  Scale,
  X,
  ArrowRight,
  Target,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useSolarStore } from '../store/useSolarStore';
import { SATELLITES } from './Satellite';
import { API_BASE_URL } from '../services/apiConfig';
import { kesslerSyncChannel } from '../services/syncChannel';

interface CollisionCalloutPanelProps {
  primarySatId: string;
  secondarySatId: string;
  simState: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED';
  simProgress: number;
}

interface AuditLedgerEntry {
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

const formatStateChange = (val?: string): string => {
  if (!val) return 'CONFIRMED';
  const clean = val.replace(/_/g, ' ').trim().toUpperCase();
  if (clean === 'UNINSURED COLLISION DESTRUCTION') return 'TOTAL LOSS // UNINSURED';
  if (clean === 'PARAMETRIC CLAIM PENDING') return 'PARAMETRIC CLAIM // PENDING';
  if (clean === 'PARAMETRIC PAYOUT EXECUTED') return 'PARAMETRIC PAYOUT // SETTLED';
  if (clean === 'RISK MITIGATED ON CHAIN') return 'RISK MITIGATED // RESOLVED';
  if (clean === 'ACTIVE CONJUNCTION TRACKING') return 'ACTIVE TRACKING // CONJUNCTION';
  if (clean === 'NOMINAL MONITORING') return 'NOMINAL MONITORING // CLEAR';
  return clean;
};

/**
 * CollisionCalloutPanel
 * Fixed HUD Contextual Information Panel // Event Inspector
 * Positioned in the upper-right peripheral HUD region (fixed in UI space).
 * Connected dynamically to the 3D scene by the CollisionCalloutOverlay SVG vector line.
 */
export const CollisionCalloutPanel: React.FC<CollisionCalloutPanelProps> = ({
  primarySatId,
  secondarySatId,
  simState,
  simProgress,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [latestAuditEntry, setLatestAuditEntry] = useState<AuditLedgerEntry | null>(null);

  const backendSatellites = useSolarStore((s) => s.backendSatellites);

  // Synchronized Master Satellite Catalog
  const uniqueSatellites = useMemo(() => {
    const list = [...SATELLITES];
    backendSatellites.forEach((b) => {
      const exists = list.some(
        (s) => s.name === b.satellite_name || s.id === b.sat_id || s.noradId === b.norad_cat_id
      );
      if (!exists && b.satellite_name) {
        list.push({
          id: b.sat_id || `SAT-${b.norad_cat_id}`,
          name: b.satellite_name,
          category: 'DYNAMIC REGISTRATION',
          noradId: b.norad_cat_id || 99999,
          semiMajorAxis: 1.12,
          eccentricity: 0.001,
          inclination: 51.6,
          raan: 45,
          argOfPerigee: 30,
          meanAnomaly: 0,
          meanMotion: 15.5,
          color: '#38bdf8',
          size: 1.0,
        } as any);
      }
    });
    return Array.from(new Map(list.map((sat) => [sat.noradId || sat.id, sat])).values());
  }, [backendSatellites]);

  const satA = useMemo(() => {
    return (
      uniqueSatellites.find(
        (s) => s.id === primarySatId || s.name === primarySatId || s.noradId.toString() === primarySatId
      ) || uniqueSatellites[0]
    );
  }, [uniqueSatellites, primarySatId]);

  const satB = useMemo(() => {
    return (
      uniqueSatellites.find(
        (s) => s.id === secondarySatId || s.name === secondarySatId || s.noradId.toString() === secondarySatId
      ) || uniqueSatellites[1]
    );
  }, [uniqueSatellites, secondarySatId]);

  const getSatelliteStatus = useSolarStore((s) => s.getSatelliteStatus);

  const isADestroyed = getSatelliteStatus(satA) === 'DESTROYED';
  const isBDestroyed = getSatelliteStatus(satB) === 'DESTROYED';
  const isARegistered = getSatelliteStatus(satA) === 'REGISTERED';
  const isBRegistered = getSatelliteStatus(satB) === 'REGISTERED';

  // Synchronize with latest audit ledger record for active pair
  const fetchLatestAudit = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audit-logs`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const list: AuditLedgerEntry[] = Array.isArray(data)
          ? data
          : data.entries && Array.isArray(data.entries)
          ? data.entries
          : [];

        // Match against satA and satB
        const match = list.find((r) => {
          const p = (r.primary_asset || '').toLowerCase();
          const t = (r.threat_asset || '').toLowerCase();
          const aName = satA.name.toLowerCase();
          const aId = (satA.id || '').toLowerCase();
          const aNorad = String(satA.noradId || '');
          const bName = satB.name.toLowerCase();
          const bId = (satB.id || '').toLowerCase();
          const bNorad = String(satB.noradId || '');

          const aMatchesP = p.includes(aName) || p.includes(aId) || (aNorad && p.includes(aNorad));
          const bMatchesT = t.includes(bName) || t.includes(bId) || (bNorad && t.includes(bNorad));
          const bMatchesP = p.includes(bName) || p.includes(bId) || (bNorad && p.includes(bNorad));
          const aMatchesT = t.includes(aName) || t.includes(aId) || (aNorad && t.includes(aNorad));

          return (aMatchesP && bMatchesT) || (bMatchesP && aMatchesT);
        });

        if (match) {
          setLatestAuditEntry(match);
        }
      }
    } catch (_) {}
  }, [satA, satB]);

  useEffect(() => {
    fetchLatestAudit();
    const interval = setInterval(fetchLatestAudit, 2500);
    const handleBroadcast = () => fetchLatestAudit();
    if (kesslerSyncChannel) {
      kesslerSyncChannel.addEventListener('message', handleBroadcast);
    }
    return () => {
      clearInterval(interval);
      if (kesslerSyncChannel) {
        kesslerSyncChannel.removeEventListener('message', handleBroadcast);
      }
    };
  }, [fetchLatestAudit]);

  // Dynamic Separation Distance
  const distanceKm = useMemo(() => {
    if (simState === 'EXPLODED') return 0.0;
    if (simState === 'EVADED') return 2.45;
    return Math.max(0.05, 15.0 * (1 - simProgress));
  }, [simState, simProgress]);

  // Dynamic Risk Level & Palette
  let riskLevel = 'NOMINAL TRACKING';
  let riskColor = '#38bdf8';
  if (simState === 'EXPLODED') {
    riskLevel = 'IMPACT CONFIRMED';
    riskColor = '#f43f5e';
  } else if (simState === 'EVADED') {
    riskLevel = 'COLLISION CLEARED';
    riskColor = '#10b981';
  } else if (simProgress >= 0.85) {
    riskLevel = 'CRITICAL PROXIMITY';
    riskColor = '#f43f5e';
  } else if (simProgress >= 0.65) {
    riskLevel = 'HIGH COLLISION RISK';
    riskColor = '#f97316';
  } else if (simProgress >= 0.35) {
    riskLevel = 'CONJUNCTION DETECTED';
    riskColor = '#f59e0b';
  } else {
    riskLevel = 'NOMINAL TRACKING';
    riskColor = '#38bdf8';
  }

  // Header Title by State
  const headerTitle = useMemo(() => {
    if (simState === 'EXPLODED') return 'CRITICAL EVENT // IMPACT CONFIRMED';
    if (simState === 'EVADED') return 'COLLISION RESOLVED // AVOIDED';
    if (simState === 'SIMULATING') return 'CONJUNCTION ANALYSIS // ACTIVE';
    return 'CONJUNCTION ANALYSIS';
  }, [simState]);

  // Causality Resolution (Neutral Pair vs Directional Impact)
  const causality = useMemo(() => {
    if (!latestAuditEntry) {
      return {
        type: 'PAIR' as const,
        labelA: 'COLLISION ASSET A',
        labelB: 'COLLISION ASSET B',
        satLeft: satA,
        satRight: satB,
        isLeftDestroyed: isADestroyed,
        isRightDestroyed: isBDestroyed,
        isLeftRegistered: isARegistered,
        isRightRegistered: isBRegistered,
      };
    }

    const eventType = (latestAuditEntry.event_type || '').toUpperCase();
    const stateChange = (latestAuditEntry.state_change || '').toUpperCase();

    // Only when actual data authoritatively establishes causality:
    if (
      eventType === 'UNINSURED_THREAT_LIABILITY' ||
      stateChange === 'THREAT_AT_FAULT_INVOICED'
    ) {
      const isThreatSatA = (latestAuditEntry.threat_asset || '').toLowerCase().includes(satA.name.toLowerCase());
      const impactorSat = isThreatSatA ? satA : satB;
      const affectedSat = isThreatSatA ? satB : satA;
      return {
        type: 'DIRECTIONAL' as const,
        labelA: 'IMPACTOR (AT-FAULT)',
        labelB: 'AFFECTED ASSET',
        satLeft: impactorSat,
        satRight: affectedSat,
        isLeftDestroyed: getSatelliteStatus(impactorSat) === 'DESTROYED',
        isRightDestroyed: getSatelliteStatus(affectedSat) === 'DESTROYED',
        isLeftRegistered: getSatelliteStatus(impactorSat) === 'REGISTERED',
        isRightRegistered: getSatelliteStatus(affectedSat) === 'REGISTERED',
      };
    }

    if (
      eventType === 'UNINSURED_PRIMARY_LIABILITY' ||
      stateChange === 'PRIMARY_AT_FAULT_INVOICED'
    ) {
      const isPrimarySatA = (latestAuditEntry.primary_asset || '').toLowerCase().includes(satA.name.toLowerCase());
      const impactorSat = isPrimarySatA ? satA : satB;
      const affectedSat = isPrimarySatA ? satB : satA;
      return {
        type: 'DIRECTIONAL' as const,
        labelA: 'IMPACTOR (AT-FAULT)',
        labelB: 'AFFECTED ASSET',
        satLeft: impactorSat,
        satRight: affectedSat,
        isLeftDestroyed: getSatelliteStatus(impactorSat) === 'DESTROYED',
        isRightDestroyed: getSatelliteStatus(affectedSat) === 'DESTROYED',
        isLeftRegistered: getSatelliteStatus(impactorSat) === 'REGISTERED',
        isRightRegistered: getSatelliteStatus(affectedSat) === 'REGISTERED',
      };
    }

    // Default: Neutral Collision Pair (State B)
    return {
      type: 'PAIR' as const,
      labelA: 'COLLISION ASSET A',
      labelB: 'COLLISION ASSET B',
      satLeft: satA,
      satRight: satB,
      isLeftDestroyed: isADestroyed,
      isRightDestroyed: isBDestroyed,
      isLeftRegistered: isARegistered,
      isRightRegistered: isBRegistered,
    };
  }, [latestAuditEntry, satA, satB, isADestroyed, isBDestroyed, isARegistered, isBRegistered, getSatelliteStatus]);

  // Financial Outcome Resolution
  const financialDetails = useMemo(() => {
    let actualPayoutText = '0.00 ETH';
    let isSettledTransfer = false;

    if (latestAuditEntry?.financial_transfer) {
      const match = latestAuditEntry.financial_transfer.match(/(\d+\.\d+)\s*ETH/i);
      if (match && !latestAuditEntry.financial_transfer.includes('0.00')) {
        actualPayoutText = `${match[1]} ETH`;
        isSettledTransfer = true;
      }
    } else if (isARegistered && isBRegistered && simState === 'EVADED') {
      actualPayoutText = '2.50 ETH';
      isSettledTransfer = true;
    }

    const isBothRegistered = isARegistered && isBRegistered;
    const isSlashed = (latestAuditEntry?.event_type || '').includes('SLASH') || 
                      (latestAuditEntry?.state_change || '').includes('SLASH') || 
                      (latestAuditEntry?.financial_transfer || '').includes('SLASH') ||
                      Boolean(latestAuditEntry?.tx_hash);
    const isRegisteredCollision = isBothRegistered || isSlashed;

    // Check if this is a registered collision / settlement
    const payoutLabel = isRegisteredCollision ? 'COLLATERAL SLASHED' : 'ACTUAL PAYOUT';
    const payoutSubtext = isRegisteredCollision
      ? 'ON-CHAIN SETTLEMENT'
      : isSettledTransfer
      ? 'ON-CHAIN SETTLEMENT'
      : 'NO ON-CHAIN TRANSFER';
    const payoutDetail = isRegisteredCollision
      ? 'TRANSFERRED TO PENALTY RESERVE'
      : isSettledTransfer
      ? 'CONTRACT-HELD STAKE'
      : null;
    const payoutFootnote = isRegisteredCollision
      ? 'PRE-DEPOSITED COLLATERAL'
      : null;
    const txHash = latestAuditEntry?.tx_hash || null;

    const exposureLabel = isBothRegistered ? 'LIABILITY CEILING' : 'EST. LIABILITY EXPOSURE';
    let exposureValue = '≈ 5.00 ETH';
    let exposureSubtitle = isBothRegistered
      ? 'OPERATOR CONTRACTUAL CEILING'
      : 'POLICY BASELINE // HYPOTHETICAL';

    if (latestAuditEntry) {
      if (latestAuditEntry.estimated_liability_exposure_eth !== null && latestAuditEntry.estimated_liability_exposure_eth !== undefined) {
        const num = Number(latestAuditEntry.estimated_liability_exposure_eth);
        exposureValue = `≈ ${num.toFixed(2)} ETH`;
      } else {
        exposureValue = 'NOT AVAILABLE';
        exposureSubtitle = 'LEGACY RECORD // NO SNAPSHOT';
      }
    } else if (isBothRegistered) {
      exposureValue = '≈ 2.50 ETH';
    }

    const coverageText = isBothRegistered ? 'ON-CHAIN REGISTERED' : 'UNINSURED';
    const coverageColor = isBothRegistered ? '#10b981' : '#f59e0b';

    let stateChangeText = 'NOMINAL_MONITORING';
    if (latestAuditEntry?.state_change) {
      stateChangeText = latestAuditEntry.state_change;
    } else if (simState === 'EXPLODED') {
      stateChangeText = isBothRegistered ? 'PARAMETRIC_CLAIM_PENDING' : 'UNINSURED_COLLISION_DESTRUCTION';
    } else if (simState === 'EVADED') {
      stateChangeText = 'RISK_MITIGATED_ON_CHAIN';
    } else if (simState === 'SIMULATING') {
      stateChangeText = 'ACTIVE_CONJUNCTION_TRACKING';
    }

    return {
      actualPayoutText,
      isSettledTransfer,
      isRegisteredCollision,
      payoutLabel,
      payoutSubtext,
      payoutDetail,
      payoutFootnote,
      txHash,
      exposureLabel,
      exposureValue,
      exposureSubtitle,
      coverageText,
      coverageColor,
      stateChangeText,
    };
  }, [latestAuditEntry, isARegistered, isBRegistered, simState]);

  return (
    <div
      id="hud-collision-callout-panel"
      style={{
        position: 'absolute',
        top: '76px',
        right: '24px',
        width: '376px',
        zIndex: 48,
        pointerEvents: 'auto',
        fontFamily: '"Space Mono", "JetBrains Mono", monospace',
        userSelect: 'none',
        background: 'linear-gradient(180deg, rgba(8, 12, 22, 0.94) 0%, rgba(2, 6, 18, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${riskColor}40`,
        borderRadius: '6px',
        padding: isMinimized ? '10px 14px' : '14px 16px',
        boxShadow: `0 24px 60px rgba(0, 0, 0, 0.88), 0 0 25px ${riskColor}18`,
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease, padding 0.2s ease',
      }}
    >
      {/* 1. Panel Header: Category Subtitle + Minimize Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMinimized ? 0 : '8px',
          borderBottom: isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: isMinimized ? 0 : '7px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Activity size={13} style={{ color: riskColor }} />
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.12em',
            }}
          >
            COLLISION CALLOUT // EVENT INSPECTOR
          </span>
        </div>

        <button
          onClick={() => setIsMinimized((prev) => !prev)}
          title={isMinimized ? 'Expand Inspector' : 'Minimize Inspector'}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '3px',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '9px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = riskColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#cbd5e1';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          {isMinimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          <span>{isMinimized ? 'EXPAND' : 'MIN'}</span>
        </button>
      </div>

      {/* Main Event Heading */}
      <div style={{ marginBottom: isMinimized ? 0 : '10px' }}>
        <div
          style={{
            fontSize: isMinimized ? '12px' : '16px',
            fontWeight: 800,
            color: simState === 'EXPLODED' ? '#fb7185' : simState === 'EVADED' ? '#34d399' : '#f8fafc',
            letterSpacing: '0.04em',
            lineHeight: '1.2',
          }}
        >
          {headerTitle}
        </div>
      </div>

      {/* Expanded Content View */}
      {!isMinimized && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 2. Unified Collision Relationship Block */}
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                paddingBottom: '5px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em' }}>
                COLLISION RELATIONSHIP
              </span>
              <span
                style={{
                  fontSize: '7.5px',
                  fontWeight: 700,
                  color: causality.type === 'DIRECTIONAL' ? '#f59e0b' : '#38bdf8',
                  letterSpacing: '0.08em',
                  background: causality.type === 'DIRECTIONAL' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.1)',
                  padding: '1px 5px',
                  borderRadius: '2px',
                }}
              >
                {causality.type === 'DIRECTIONAL' ? 'CAUSAL ATTRIBUTION' : 'CO-EQUAL CONTACT PAIR'}
              </span>
            </div>

            {/* Asset A ─── Marker ─── Asset B */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              {/* Asset Left */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: causality.type === 'DIRECTIONAL' ? '#f59e0b' : '#94a3b8',
                    letterSpacing: '0.08em',
                  }}
                >
                  {causality.labelA}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: causality.isLeftDestroyed ? '#64748b' : '#ffffff',
                    textDecoration: causality.isLeftDestroyed ? 'line-through' : 'none',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={causality.satLeft.name}
                >
                  {causality.satLeft.name}
                </div>
                <div
                  style={{
                    fontSize: '8px',
                    color: '#64748b',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{causality.satLeft.noradId} // {causality.satLeft.category}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <span
                    style={{
                      fontSize: '7.5px',
                      fontWeight: 700,
                      padding: '1px 4px',
                      borderRadius: '2px',
                      background: causality.isLeftDestroyed
                        ? 'rgba(244, 63, 94, 0.15)'
                        : causality.isLeftRegistered
                        ? 'rgba(52, 211, 153, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: causality.isLeftDestroyed ? '#f43f5e' : causality.isLeftRegistered ? '#34d399' : '#fbbf24',
                      border: `1px solid ${
                        causality.isLeftDestroyed ? '#f43f5e55' : causality.isLeftRegistered ? '#34d39955' : '#fbbf2455'
                      }`,
                    }}
                  >
                    {causality.isLeftDestroyed ? 'DESTROYED' : causality.isLeftRegistered ? 'REGISTERED' : 'UNREGISTERED'}
                  </span>
                </div>
              </div>

              {/* Central Contact Marker */}
              {causality.type === 'DIRECTIONAL' ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    flexShrink: 0,
                    minWidth: '80px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '7.5px',
                      fontWeight: 800,
                      color: '#f59e0b',
                      letterSpacing: '0.08em',
                      marginBottom: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    IMPACT VECTOR
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.2), #f59e0b)' }} />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                        flexShrink: 0,
                      }}
                      title="Authoritative Directional Impact Vector"
                    >
                      <ArrowRight size={11} strokeWidth={2.8} style={{ color: '#f59e0b' }} />
                    </div>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #f59e0b, rgba(56, 189, 248, 0.3))' }} />
                  </div>
                  <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.06em', marginTop: '3px' }}>
                    PCA IMPACT
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    flexShrink: 0,
                    minWidth: '80px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '7.5px',
                      fontWeight: 800,
                      color: '#94a3b8',
                      letterSpacing: '0.08em',
                      marginBottom: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {simState === 'EXPLODED' ? 'IMPACT POINT' : 'PCA CONTACT'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, rgba(255, 255, 255, 0.08), ${riskColor}88)` }} />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        background: 'rgba(2, 6, 23, 0.85)',
                        border: `1px solid ${riskColor}`,
                        boxShadow: `0 0 8px ${riskColor}44`,
                        flexShrink: 0,
                      }}
                      title="Point of Closest Approach (PCA) Contact"
                    >
                      <X size={11} strokeWidth={2.8} style={{ color: riskColor }} />
                    </div>
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${riskColor}88, rgba(255, 255, 255, 0.08))` }} />
                  </div>
                  <span style={{ fontSize: '7px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginTop: '3px' }}>
                    COLLISION PAIR
                  </span>
                </div>
              )}

              {/* Asset Right */}
              <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: causality.type === 'DIRECTIONAL' ? '#38bdf8' : '#94a3b8',
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                  }}
                >
                  <span>{causality.labelB}</span>
                  {causality.type === 'DIRECTIONAL' && <Target size={9} />}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: causality.isRightDestroyed ? '#64748b' : '#ffffff',
                    textDecoration: causality.isRightDestroyed ? 'line-through' : 'none',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={causality.satRight.name}
                >
                  {causality.satRight.name}
                </div>
                <div
                  style={{
                    fontSize: '8px',
                    color: '#64748b',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{causality.satRight.noradId} // {causality.satRight.category}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <span
                    style={{
                      fontSize: '7.5px',
                      fontWeight: 700,
                      padding: '1px 4px',
                      borderRadius: '2px',
                      background: causality.isRightDestroyed
                        ? 'rgba(244, 63, 94, 0.15)'
                        : causality.isRightRegistered
                        ? 'rgba(52, 211, 153, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: causality.isRightDestroyed ? '#f43f5e' : causality.isRightRegistered ? '#34d399' : '#fbbf24',
                      border: `1px solid ${
                        causality.isRightDestroyed ? '#f43f5e55' : causality.isRightRegistered ? '#34d39955' : '#fbbf2455'
                      }`,
                    }}
                  >
                    {causality.isRightDestroyed ? 'DESTROYED' : causality.isRightRegistered ? 'REGISTERED' : 'UNREGISTERED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Conjunction & PCA Telemetry Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            {/* Separation (PCA) */}
            <div
              style={{
                background: 'rgba(2, 6, 23, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em' }}>
                {simState === 'EXPLODED' ? 'PCA AT IMPACT' : 'SEPARATION (PCA)'}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: riskColor,
                  letterSpacing: '0.02em',
                  marginTop: '2px',
                }}
              >
                {distanceKm.toFixed(2)}{' '}
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>KM</span>
              </div>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '2px' }}>
                {simState === 'EXPLODED'
                  ? 'KINETIC IMPACT OCCURRED'
                  : simState === 'EVADED'
                  ? 'SAFE ORBIT RESTORED'
                  : 'PCA THRESHOLD: 5.00 KM'}
              </div>
            </div>

            {/* Current Risk / State */}
            <div
              style={{
                background: 'rgba(2, 6, 23, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em' }}>
                CURRENT RISK
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: riskColor,
                  marginTop: '4px',
                  lineHeight: '1.2',
                }}
              >
                {riskLevel}
              </div>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '3px' }}>
                STATE: <span style={{ color: '#f8fafc', fontWeight: 700 }}>{simState}</span>
              </div>
            </div>
          </div>

          {/* 4. Financial & Insurance Result */}
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Section Subheader */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Coins size={11} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.1em' }}>
                  FINANCIAL & INSURANCE RESULT
                </span>
              </div>
              <span
                style={{
                  fontSize: '7.5px',
                  fontWeight: 700,
                  color: financialDetails.coverageColor,
                  background: `${financialDetails.coverageColor}18`,
                  border: `1px solid ${financialDetails.coverageColor}44`,
                  padding: '1px 5px',
                  borderRadius: '2px',
                }}
              >
                {financialDetails.coverageText}
              </span>
            </div>

            {/* Comparison Grid: ACTUAL SETTLEMENT / COLLATERAL SLASH vs ESTIMATED EXPOSURE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Actual Settlement / Payout */}
              <div>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>
                  {financialDetails.payoutLabel}
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    marginTop: '2px',
                    color: financialDetails.isSettledTransfer ? '#06b6d4' : '#94a3b8',
                  }}
                >
                  {financialDetails.actualPayoutText}
                </div>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: financialDetails.isRegisteredCollision ? '#38bdf8' : '#64748b', letterSpacing: '0.04em', marginTop: '2px' }}>
                  {financialDetails.payoutSubtext}
                </div>
                {financialDetails.payoutDetail && (
                  <div style={{ fontSize: '7px', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.03em', marginTop: '1px' }}>
                    {financialDetails.payoutDetail}
                  </div>
                )}
                {financialDetails.payoutFootnote && (
                  <div style={{ fontSize: '6.5px', fontWeight: 600, color: '#64748b', letterSpacing: '0.03em', marginTop: '1px' }}>
                    {financialDetails.payoutFootnote}
                  </div>
                )}
                {financialDetails.txHash && (
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
                    title={`On-Chain Settlement Tx: ${financialDetails.txHash}`}
                  >
                    <ExternalLink size={7} />
                    <span>TX: {financialDetails.txHash.slice(0, 8)}...{financialDetails.txHash.slice(-6)}</span>
                  </div>
                )}
              </div>

              {/* Estimated Liability Exposure / Liability Ceiling */}
              <div>
                <div
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: isARegistered && isBRegistered ? '#38bdf8' : '#f59e0b',
                    letterSpacing: '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Scale size={9} />
                  <span>{financialDetails.exposureLabel}</span>
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    marginTop: '2px',
                    color: financialDetails.exposureValue !== 'NOT AVAILABLE' ? '#fbbf24' : '#64748b',
                  }}
                >
                  {financialDetails.exposureValue}
                </div>
                <div
                  style={{
                    fontSize: '7.5px',
                    fontWeight: 700,
                    color: financialDetails.exposureValue !== 'NOT AVAILABLE' ? '#d97706' : '#475569',
                    letterSpacing: '0.04em',
                    marginTop: '2px',
                  }}
                >
                  {financialDetails.exposureSubtitle}
                </div>
              </div>
            </div>

            {/* Supporting Metadata: Coverage & State Change */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>
                  COVERAGE STATUS
                </div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                  {financialDetails.coverageText === 'ON-CHAIN REGISTERED'
                    ? 'ARBITRATION ELIGIBLE'
                    : 'UNINSURED LOSS RISK'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' }}>
                  STATE CHANGE
                </div>
                <div
                  style={{
                    fontSize: '8.5px',
                    fontWeight: 800,
                    color: '#94a3b8',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={financialDetails.stateChangeText}
                >
                  {formatStateChange(financialDetails.stateChangeText)}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Audit & Subsystem Trace */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '7.5px',
              color: '#64748b',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={10} style={{ color: '#818cf8' }} />
              <span>SQLITE AUDIT_LEDGER SYNCED</span>
            </div>
            <span>
              {simState === 'EXPLODED' ? 'PHYSICAL CONTACT RECORDED' : 'REAL-TIME TELEMETRY STREAM'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollisionCalloutPanel;