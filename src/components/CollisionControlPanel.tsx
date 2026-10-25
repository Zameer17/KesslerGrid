import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSolarStore } from '../store/useSolarStore';
import { SATELLITES } from './Satellite';
import { api } from '../services/api';
import { broadcastSatelliteRefresh } from '../services/syncChannel';
import {
  Crosshair,
  ShieldCheck,
  Skull,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
  Target,
  Radio,
  Globe,
  Cloud,
  Shield,
  AlertTriangle,
  Compass,
  Coins,
} from 'lucide-react';

interface CollisionControlPanelProps {
  primarySatId: string;
  setPrimarySatId: (id: string) => void;
  secondarySatId: string;
  setSecondarySatId: (id: string) => void;
  simState: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED';
  simProgress: number;
  onStartSimulation: () => void;
  onBurnExecuted: () => void;
  onImpact: () => void;
  setSimState?: (state: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED') => void;
}

export function CollisionControlPanel({
  primarySatId,
  setPrimarySatId,
  secondarySatId,
  setSecondarySatId,
  simState,
  simProgress,
  onStartSimulation,
  onBurnExecuted,
  onImpact,
  setSimState,
}: CollisionControlPanelProps) {
  // =========================================================================
  // 1. ALL REACT HOOKS MUST BE DECLARED AT THE ABSOLUTE TOP OF THE COMPONENT
  // NO EARLY RETURNS OF ANY KIND ARE ALLOWED ABOVE THIS LINE.
  // =========================================================================
  const focusedBody = useSolarStore((s) => s.focusedBody);
  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const isFocusMode = useSolarStore((s) => s.isFocusMode);
  const toggleFocusMode = useSolarStore((s) => s.toggleFocusMode);
  const setDemoFocusPair = useSolarStore((s) => s.setDemoFocusPair);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [liabilityText, setLiabilityText] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Custom Dropdown Open States and Click-Outside Listeners
  const [isPrimaryOpen, setIsPrimaryOpen] = useState(false);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
  const primaryDropdownRef = useRef<HTMLDivElement>(null);
  const secondaryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (primaryDropdownRef.current && !primaryDropdownRef.current.contains(event.target as Node)) {
        setIsPrimaryOpen(false);
      }
      if (secondaryDropdownRef.current && !secondaryDropdownRef.current.contains(event.target as Node)) {
        setIsSecondaryOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPrimaryOpen(false);
        setIsSecondaryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Professional Category Vector Icon Resolver (Strictly NO emojis)
  const getSatelliteIcon = useCallback((cat?: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('station')) return Crosshair;
    if (c.includes('constellation') || c.includes('communication') || c.includes('telecom')) return Radio;
    if (c.includes('observation') || c.includes('earth')) return Globe;
    if (c.includes('weather') || c.includes('climate')) return Cloud;
    if (c.includes('science')) return Activity;
    if (c.includes('defense') || c.includes('security')) return Shield;
    if (c.includes('navigation') || c.includes('gps')) return Compass;
    if (c.includes('debris') || c.includes('risk')) return AlertTriangle;
    return Crosshair;
  }, []);

  // Synchronized Master Satellite List (Combines static NORAD catalog + dynamic backendSatellites store)
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

  const primarySat = useMemo(() => {
    return (
      uniqueSatellites.find(
        (s) => s.id === primarySatId || s.name === primarySatId || s.noradId.toString() === primarySatId
      ) || uniqueSatellites[0]
    );
  }, [uniqueSatellites, primarySatId]);

  const secondarySat = useMemo(() => {
    return (
      uniqueSatellites.find(
        (s) => s.id === secondarySatId || s.name === secondarySatId || s.noradId.toString() === secondarySatId
      ) || uniqueSatellites[1]
    );
  }, [uniqueSatellites, secondarySatId]);

  // Synchronize target pair for 3D focus isolation mode
  useEffect(() => {
    setDemoFocusPair([primarySatId, secondarySatId]);
  }, [primarySatId, secondarySatId, setDemoFocusPair]);

  // Reset auto trigger state on idle
  useEffect(() => {
    if (simState === 'IDLE') {
      setAutoTriggered(false);
      setLiabilityText(null);
      setToastMsg(null);
    }
  }, [simState]);

  const getSatelliteStatus = useSolarStore((s) => s.getSatelliteStatus);

  // Helper check for registration status and liability penalty
  const getSatRegistrationInfo = useCallback(
    (sat: typeof primarySat) => {
      const status = getSatelliteStatus(sat);
      const isReg = status === 'REGISTERED';
      const dbRec = backendSatellites.find((b) => {
        const matchNorad = b.norad_cat_id && sat.noradId && Number(b.norad_cat_id) === Number(sat.noradId);
        const matchSatId = b.sat_id && sat.id && String(b.sat_id).toLowerCase() === String(sat.id).toLowerCase();
        const matchName = b.satellite_name && sat.name && String(b.satellite_name).toLowerCase() === String(sat.name).toLowerCase();
        return matchNorad || matchSatId || matchName;
      });
      const penaltyEth = dbRec?.liability_penalty_eth || 5.0;
      return { isReg, penaltyEth, dbRec };
    },
    [backendSatellites, getSatelliteStatus]
  );

  // Autonomous Smart Contract Trigger & Liability Assessment Logic
  useEffect(() => {
    if (simState !== 'SIMULATING' || autoTriggered) return;

    // Critical threshold: progress >= 0.35 (distance < 5.0 km)
    if (simProgress >= 0.35) {
      setAutoTriggered(true);

      const pReg = getSatRegistrationInfo(primarySat);
      const sReg = getSatRegistrationInfo(secondarySat);

      if (pReg.isReg && sReg.isReg) {
        const msg = `AUTONOMOUS SMART CONTRACT TRIGGERED\nMutual avoidance coordinated for ${primarySat.name} & ${secondarySat.name}. Shared gas split.`;
        setToastMsg(msg);
        setLiabilityText('MUTUAL AVOIDANCE COORDINATED: Both assets registered on-chain. Risk mitigated.');
        useSolarStore.getState().addAuditLog(`AUTONOMOUS CONTRACT: Mutual avoidance burn (2.50 ETH) executed for ${primarySat.name} & ${secondarySat.name}.`);
        // Log for Asset A
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'MUTUAL_AVOIDANCE',
            primary_asset: primarySat.name,
            threat_asset: secondarySat.name,
            financial_transfer: '2.50 ETH BURN',
            state_change: 'MUTUAL AVOIDANCE EXECUTED',
            estimated_liability_exposure_eth: 2.50
          })
        }).then(async () => {
          // Log for Asset B
          await fetch('/api/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'MUTUAL_AVOIDANCE',
              primary_asset: secondarySat.name,
              threat_asset: primarySat.name,
              financial_transfer: '2.50 ETH BURN',
              state_change: 'MUTUAL AVOIDANCE EXECUTED',
              estimated_liability_exposure_eth: 2.50
            })
          });

          if (typeof api.fetchSatellites === 'function') {
            const fresh = await api.fetchSatellites();
            if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
          }
          broadcastSatelliteRefresh();
        }).catch(err => console.warn('Audit log post note:', err));
        onBurnExecuted();
      } else if (pReg.isReg && !sReg.isReg) {
        const avoidanceBurnEth = 2.50;
        const invoiceStr = `AVOIDANCE BURN: ${avoidanceBurnEth.toFixed(2)} ETH executed. Orbital corridor cleared.`;
        const msg = `AUTONOMOUS SMART CONTRACT TRIGGERED\n${invoiceStr}`;
        setToastMsg(msg);
        setLiabilityText(`AVOIDANCE MANEUVER: ${primarySat.name} executed tactical burn of ${avoidanceBurnEth.toFixed(2)} ETH. Threat ${secondarySat.name} evaded.`);
        useSolarStore.getState().addAuditLog(`AUTONOMOUS CONTRACT: ${primarySat.name} executed 2.50 ETH avoidance burn to evade ${secondarySat.name}.`);
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'ASYMMETRIC_AVOIDANCE',
            primary_asset: primarySat.name,
            threat_asset: secondarySat.name,
            financial_transfer: '2.50 ETH BURN',
            state_change: 'AVOIDANCE MANEUVER EXECUTED',
            estimated_liability_exposure_eth: 2.50
          })
        }).then(async () => {
          if (typeof api.fetchSatellites === 'function') {
            const fresh = await api.fetchSatellites();
            if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
          }
          broadcastSatelliteRefresh();
        }).catch(err => console.warn('Audit log post note:', err));
        onBurnExecuted();
      } else if (!pReg.isReg && sReg.isReg) {
        const avoidanceBurnEth = 2.50;
        const invoiceStr = `AVOIDANCE BURN: ${avoidanceBurnEth.toFixed(2)} ETH executed. Orbital corridor cleared.`;
        const msg = `AUTONOMOUS SMART CONTRACT TRIGGERED\n${invoiceStr}`;
        setToastMsg(msg);
        setLiabilityText(`AVOIDANCE MANEUVER: ${secondarySat.name} executed tactical burn of ${avoidanceBurnEth.toFixed(2)} ETH. Threat ${primarySat.name} evaded.`);
        useSolarStore.getState().addAuditLog(`AUTONOMOUS CONTRACT: ${secondarySat.name} executed 2.50 ETH avoidance burn to evade ${primarySat.name}.`);
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'ASYMMETRIC_AVOIDANCE',
            primary_asset: secondarySat.name,
            threat_asset: primarySat.name,
            financial_transfer: '2.50 ETH BURN',
            state_change: 'AVOIDANCE MANEUVER EXECUTED',
            estimated_liability_exposure_eth: 2.50
          })
        }).then(async () => {
          if (typeof api.fetchSatellites === 'function') {
            const fresh = await api.fetchSatellites();
            if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
          }
          broadcastSatelliteRefresh();
        }).catch(err => console.warn('Audit log post note:', err));
        onBurnExecuted();
      } else {
        const uninsTransfer = 'UNINSURED LOSS: 0.00 ETH parametric payout. Total destruction imminent at PCA.';
        const msg = `UNINSURED LOSS: Both assets unregistered. Total destruction imminent at PCA. No parametric payout.`;
        setToastMsg(msg);
        setLiabilityText('UNINSURED LOSS: Total destruction at PCA. No parametric payout.');
        useSolarStore.getState().addAuditLog(`UNINSURED LOSS: ${primarySat.name} <-> ${secondarySat.name}`);
        fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'UNINSURED_TOTAL_LOSS',
            primary_asset: primarySat.name,
            threat_asset: secondarySat.name,
            financial_transfer: uninsTransfer,
            state_change: 'UNINSURED_COLLISION_DESTRUCTION'
          })
        }).catch(err => console.warn('Audit log post note:', err));
      }
    }
  }, [simState, simProgress, autoTriggered, primarySat, secondarySat, getSatRegistrationInfo, onBurnExecuted]);

  // Handle Total Destruction at PCA Impact
  useEffect(() => {
    if (simState === 'SIMULATING' && simProgress >= 0.95) {
      onImpact();
    }
  }, [simState, simProgress, onImpact]);

  // =========================================================================
  // 2. CONDITIONAL EARLY RETURNS ARE ONLY PERMITTED BELOW ALL HOOK DECLARATIONS
  // =========================================================================
  const hiddenBodies = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  if (hiddenBodies.includes(focusedBody)) {
    return null;
  }

  const isPrimaryDestroyed = getSatelliteStatus(primarySat) === 'DESTROYED';
  const isSecondaryDestroyed = getSatelliteStatus(secondarySat) === 'DESTROYED';
  const isPrimaryRegistered = getSatelliteStatus(primarySat) === 'REGISTERED';
  const isSecondaryRegistered = getSatelliteStatus(secondarySat) === 'REGISTERED';

  const approachDistanceKm = Math.max(0, 15.0 * (1 - simProgress)).toFixed(2);
  const timeToPcaSec = Math.max(0, (1 - simProgress) * 8.3).toFixed(1);
  let currentRiskLevel = 'SAFE APPROACH';
  let riskColor = '#38bdf8';
  if (simProgress >= 0.85) {
    currentRiskLevel = 'CRITICAL PROXIMITY';
    riskColor = '#f43f5e';
  } else if (simProgress >= 0.65) {
    currentRiskLevel = 'HIGH COLLISION RISK';
    riskColor = '#f97316';
  } else if (simProgress >= 0.35) {
    currentRiskLevel = 'CONJUNCTION DETECTED';
    riskColor = '#f59e0b';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        left: '24px',
        zIndex: 50,
        pointerEvents: 'auto',
        fontFamily: '"Space Mono", "JetBrains Mono", monospace',
        userSelect: 'none',
        width: '350px',
      }}
    >
      {/* Toast Notification Container */}
      {toastMsg && (
        <div
          style={{
            marginBottom: '10px',
            background: toastMsg.includes('UNINSURED') || toastMsg.includes('DESTRUCTION')
              ? 'linear-gradient(135deg, rgba(225, 29, 72, 0.95) 0%, rgba(159, 18, 57, 0.98) 100%)'
              : toastMsg.includes('SUCCESS') || toastMsg.includes('MUTUAL')
              ? 'linear-gradient(135deg, rgba(5, 150, 105, 0.95) 0%, rgba(4, 120, 87, 0.98) 100%)'
              : 'linear-gradient(135deg, rgba(217, 119, 6, 0.95) 0%, rgba(180, 83, 9, 0.98) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            padding: '10px 12px',
            color: '#ffffff',
            fontSize: '10.5px',
            fontWeight: 700,
            lineHeight: '1.45',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            whiteSpace: 'pre-line',
          }}
        >
          <div>{toastMsg}</div>
          <button
            onClick={() => setToastMsg(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 5px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Glassmorphic Control Panel Card */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(8, 12, 22, 0.95) 0%, rgba(2, 6, 18, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          padding: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(244, 63, 94, 0.08)',
        }}
      >
        {/* Header Rail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crosshair size={14} style={{ color: '#f43f5e' }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '1.2px',
              }}
            >
              AUTONOMOUS STM ENGINE
            </span>
          </div>

          {/* Focus Collision Isolation Toggle Button */}
          <button
            onClick={toggleFocusMode}
            title="Isolate target pair in 3D space"
            style={{
              background: isFocusMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isFocusMode ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)'}`,
              borderRadius: '4px',
              padding: '3px 8px',
              color: isFocusMode ? '#38bdf8' : '#94a3b8',
              fontSize: '9.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease',
            }}
          >
            <Crosshair size={11} />
            <span>FOCUS: {isFocusMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Primary Satellite Selector (Cyan semantic treatment) */}
        <div ref={primaryDropdownRef} style={{ marginBottom: '14px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: '9.5px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.8px' }}>
              TARGET A: PRIMARY ASSET
            </label>
            <span style={{ fontSize: '9px', color: isPrimaryDestroyed ? '#f43f5e' : '#64748b' }}>
              {isPrimaryDestroyed ? 'STATUS: OFFLINE' : 'STATUS: NOMINAL'}
            </span>
          </div>

          {/* Closed Trigger Control */}
          <div
            onClick={() => {
              if (simState !== 'SIMULATING') {
                setIsPrimaryOpen((prev) => !prev);
                setIsSecondaryOpen(false);
              }
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(180deg, rgba(8, 14, 28, 0.98) 0%, rgba(2, 6, 18, 0.99) 100%)',
              border: `1px solid ${
                isPrimaryDestroyed
                  ? '#f43f5e'
                  : isPrimaryOpen
                  ? 'rgba(6, 182, 212, 0.7)'
                  : 'rgba(6, 182, 212, 0.35)'
              }`,
              borderRadius: '4px',
              padding: '8px 10px',
              cursor: simState === 'SIMULATING' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              boxShadow: isPrimaryOpen
                ? '0 0 16px rgba(6, 182, 212, 0.25), inset 0 0 12px rgba(6, 182, 212, 0.08)'
                : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              {(() => {
                const PrimIcon = getSatelliteIcon(primarySat?.category);
                const isReg = getSatelliteStatus(primarySat) === 'REGISTERED';
                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '3px',
                        background: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: isPrimaryDestroyed ? '#f43f5e' : '#38bdf8',
                        flexShrink: 0,
                      }}
                    >
                      <PrimIcon size={12} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '2px',
                            background: isPrimaryDestroyed
                              ? 'rgba(244, 63, 94, 0.15)'
                              : isReg
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                            border: `1px solid ${
                              isPrimaryDestroyed
                                ? 'rgba(244, 63, 94, 0.4)'
                                : isReg
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'rgba(148, 163, 184, 0.3)'
                            }`,
                            color: isPrimaryDestroyed ? '#f43f5e' : isReg ? '#34d399' : '#cbd5e1',
                            letterSpacing: '0.4px',
                            flexShrink: 0,
                          }}
                        >
                          {isPrimaryDestroyed ? '[DESTROYED]' : isReg ? '[REG]' : '[UNREG]'}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isPrimaryDestroyed ? '#f43f5e' : '#f8fafc',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {primarySat.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#64748b',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px',
                        }}
                      >
                        {primarySat.category?.toUpperCase()} // #{primarySat.noradId || primarySat.id}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ color: '#38bdf8', display: 'flex', alignItems: 'center' }}>
              {isPrimaryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </div>

          {/* Open Dropdown Popover */}
          {isPrimaryOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: '340px',
                background: 'linear-gradient(180deg, rgba(4, 9, 20, 0.98) 0%, rgba(2, 6, 16, 0.99) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                borderRadius: '4px',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(6, 182, 212, 0.15)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Contextual Catalog Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: 'rgba(6, 182, 212, 0.08)',
                  borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  letterSpacing: '1px',
                }}
              >
                <span>SATELLITE CATALOG // PRIMARY ASSET</span>
                <span style={{ color: '#94a3b8' }}>{uniqueSatellites.length} ASSETS</span>
              </div>

              {/* Scrollable Satellite Rows */}
              <div
                style={{
                  overflowY: 'auto',
                  flex: 1,
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {uniqueSatellites.map((sat) => {
                  const status = getSatelliteStatus(sat);
                  const isDestroyed = status === 'DESTROYED';
                  const isReg = status === 'REGISTERED';
                  const isSelected = sat.id === primarySatId;
                  const IconComp = getSatelliteIcon(sat.category);

                  return (
                    <div
                      key={`prim-custom-opt-${sat.noradId || sat.id}`}
                      onClick={() => {
                        if (isDestroyed) return;
                        setPrimarySatId(sat.id);
                        if (simState !== 'SIMULATING' && setSimState) {
                          setSimState('IDLE');
                        }
                        setIsPrimaryOpen(false);
                      }}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '3px',
                        background: isSelected
                          ? 'rgba(6, 182, 212, 0.14)'
                          : 'transparent',
                        borderLeft: isSelected
                          ? '2px solid #06b6d4'
                          : '2px solid transparent',
                        cursor: isDestroyed ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        transition: 'all 0.12s ease',
                        opacity: isDestroyed ? 0.45 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isDestroyed && !isSelected) {
                          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.06)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDestroyed && !isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            color: isDestroyed ? '#64748b' : isSelected ? '#38bdf8' : '#94a3b8',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <IconComp size={13} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                padding: '1px 3px',
                                borderRadius: '2px',
                                background: isDestroyed
                                  ? 'rgba(244, 63, 94, 0.15)'
                                  : isReg
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(148, 163, 184, 0.15)',
                                color: isDestroyed ? '#f43f5e' : isReg ? '#34d399' : '#94a3b8',
                                flexShrink: 0,
                              }}
                            >
                              {isDestroyed ? '[DESTROYED]' : isReg ? '[REG]' : '[UNREG]'}
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: isSelected ? 700 : 600,
                                color: isDestroyed
                                  ? '#64748b'
                                  : isSelected
                                  ? '#ffffff'
                                  : '#e2e8f0',
                                textDecoration: isDestroyed ? 'line-through' : 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {sat.name}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '8.5px',
                              color: '#64748b',
                              marginTop: '1px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {sat.category} // #{sat.noradId || sat.id}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <Target size={11} style={{ color: '#06b6d4' }} />
                          <span style={{ fontSize: '8px', fontWeight: 700, color: '#06b6d4' }}>TARGET</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Threat Satellite Selector (Rose/Amber semantic treatment) */}
        <div ref={secondaryDropdownRef} style={{ marginBottom: '14px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: '9.5px', fontWeight: 700, color: '#f43f5e', letterSpacing: '0.8px' }}>
              TARGET B: CONJUNCTION THREAT / DEBRIS
            </label>
            <span style={{ fontSize: '9px', color: isSecondaryDestroyed ? '#f43f5e' : '#64748b' }}>
              {isSecondaryDestroyed ? 'STATUS: OFFLINE' : 'STATUS: TRACKED'}
            </span>
          </div>

          {/* Closed Trigger Control */}
          <div
            onClick={() => {
              if (simState !== 'SIMULATING') {
                setIsSecondaryOpen((prev) => !prev);
                setIsPrimaryOpen(false);
              }
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(180deg, rgba(20, 8, 14, 0.98) 0%, rgba(14, 4, 8, 0.99) 100%)',
              border: `1px solid ${
                isSecondaryDestroyed
                  ? '#f43f5e'
                  : isSecondaryOpen
                  ? 'rgba(244, 63, 94, 0.7)'
                  : 'rgba(244, 63, 94, 0.35)'
              }`,
              borderRadius: '4px',
              padding: '8px 10px',
              cursor: simState === 'SIMULATING' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              boxShadow: isSecondaryOpen
                ? '0 0 16px rgba(244, 63, 94, 0.25), inset 0 0 12px rgba(244, 63, 94, 0.08)'
                : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              {(() => {
                const SecIcon = getSatelliteIcon(secondarySat?.category);
                const isReg = getSatelliteStatus(secondarySat) === 'REGISTERED';
                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '3px',
                        background: 'rgba(244, 63, 94, 0.12)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        color: isSecondaryDestroyed ? '#f43f5e' : '#fb7185',
                        flexShrink: 0,
                      }}
                    >
                      <SecIcon size={12} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '2px',
                            background: isSecondaryDestroyed
                              ? 'rgba(244, 63, 94, 0.15)'
                              : isReg
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                            border: `1px solid ${
                              isSecondaryDestroyed
                                ? 'rgba(244, 63, 94, 0.4)'
                                : isReg
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'rgba(148, 163, 184, 0.3)'
                            }`,
                            color: isSecondaryDestroyed ? '#f43f5e' : isReg ? '#34d399' : '#cbd5e1',
                            letterSpacing: '0.4px',
                            flexShrink: 0,
                          }}
                        >
                          {isSecondaryDestroyed ? '[DESTROYED]' : isReg ? '[REG]' : '[UNREG]'}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isSecondaryDestroyed ? '#f43f5e' : '#f8fafc',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {secondarySat.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#64748b',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px',
                        }}
                      >
                        {secondarySat.category?.toUpperCase()} // #{secondarySat.noradId || secondarySat.id}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ color: '#f43f5e', display: 'flex', alignItems: 'center' }}>
              {isSecondaryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </div>

          {/* Open Dropdown Popover */}
          {isSecondaryOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: '340px',
                background: 'linear-gradient(180deg, rgba(16, 6, 12, 0.98) 0%, rgba(8, 2, 6, 0.99) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: '4px',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(244, 63, 94, 0.15)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Contextual Catalog Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: 'rgba(244, 63, 94, 0.08)',
                  borderBottom: '1px solid rgba(244, 63, 94, 0.2)',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#fb7185',
                  letterSpacing: '1px',
                }}
              >
                <span>SATELLITE CATALOG // CONJUNCTION THREAT</span>
                <span style={{ color: '#94a3b8' }}>
                  {uniqueSatellites.filter((s) => s.id !== primarySatId).length} ASSETS
                </span>
              </div>

              {/* Scrollable Satellite Rows */}
              <div
                style={{
                  overflowY: 'auto',
                  flex: 1,
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {uniqueSatellites
                  .filter((s) => s.id !== primarySatId)
                  .map((sat) => {
                    const status = getSatelliteStatus(sat);
                    const isDestroyed = status === 'DESTROYED';
                    const isReg = status === 'REGISTERED';
                    const isSelected = sat.id === secondarySatId;
                    const IconComp = getSatelliteIcon(sat.category);

                    return (
                      <div
                        key={`threat-custom-opt-${sat.noradId || sat.id}`}
                        onClick={() => {
                          if (isDestroyed) return;
                          setSecondarySatId(sat.id);
                          if (simState !== 'SIMULATING' && setSimState) {
                            setSimState('IDLE');
                          }
                          setIsSecondaryOpen(false);
                        }}
                        style={{
                          padding: '7px 8px',
                          borderRadius: '3px',
                          background: isSelected
                            ? 'rgba(244, 63, 94, 0.14)'
                            : 'transparent',
                          borderLeft: isSelected
                            ? '2px solid #f43f5e'
                            : '2px solid transparent',
                          cursor: isDestroyed ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          transition: 'all 0.12s ease',
                          opacity: isDestroyed ? 0.45 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isDestroyed && !isSelected) {
                            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.06)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isDestroyed && !isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              color: isDestroyed ? '#64748b' : isSelected ? '#fb7185' : '#94a3b8',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <IconComp size={13} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '8px',
                                  fontWeight: 700,
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                  background: isDestroyed
                                    ? 'rgba(244, 63, 94, 0.15)'
                                    : isReg
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(148, 163, 184, 0.15)',
                                  color: isDestroyed ? '#f43f5e' : isReg ? '#34d399' : '#94a3b8',
                                  flexShrink: 0,
                                }}
                              >
                                {isDestroyed ? '[DESTROYED]' : isReg ? '[REG]' : '[UNREG]'}
                              </span>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: isSelected ? 700 : 600,
                                  color: isDestroyed
                                    ? '#64748b'
                                    : isSelected
                                    ? '#ffffff'
                                    : '#e2e8f0',
                                  textDecoration: isDestroyed ? 'line-through' : 'none',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {sat.name}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '8.5px',
                                color: '#64748b',
                                marginTop: '1px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {sat.category} // #{sat.noradId || sat.id}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <AlertTriangle size={11} style={{ color: '#f43f5e' }} />
                            <span style={{ fontSize: '8px', fontWeight: 700, color: '#f43f5e' }}>THREAT</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* COLLISION TELEMETRY HUD PRESENTATION CARDS                */}
        {/* ========================================================= */}

        {/* 1. IDLE: Pre-Flight Conjunction Matrix */}
        {simState === 'IDLE' && (
          <div
            style={{
              marginBottom: '12px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              padding: '10px 12px',
              fontSize: '9.5px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={12} style={{ color: '#38bdf8' }} />
                <span style={{ color: '#94a3b8', fontWeight: 700, letterSpacing: '0.8px' }}>
                  CONJUNCTION TELEMETRY
                </span>
              </div>
              <span
                style={{
                  color: isPrimaryDestroyed || isSecondaryDestroyed ? '#f43f5e' : '#38bdf8',
                  fontWeight: 700,
                  fontSize: '8px',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: isPrimaryDestroyed || isSecondaryDestroyed
                    ? 'rgba(244, 63, 94, 0.15)'
                    : 'rgba(56, 189, 248, 0.12)',
                  border: isPrimaryDestroyed || isSecondaryDestroyed
                    ? '1px solid rgba(244, 63, 94, 0.4)'
                    : '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                {isPrimaryDestroyed || isSecondaryDestroyed ? 'ASSET CASUALTY' : 'STANDBY // READY'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                }}
              >
                <div style={{ color: '#38bdf8', fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>
                  TARGET A: PRIMARY
                </div>
                <div
                  style={{
                    color: isPrimaryDestroyed ? '#64748b' : '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: isPrimaryDestroyed ? 'line-through' : 'none',
                  }}
                >
                  {primarySat.name}
                </div>
                <div
                  style={{
                    color: isPrimaryDestroyed ? '#f43f5e' : isPrimaryRegistered ? '#34d399' : '#fbbf24',
                    fontSize: '8px',
                    fontWeight: 700,
                    marginTop: '3px',
                  }}
                >
                  {isPrimaryDestroyed ? '[DESTROYED]' : isPrimaryRegistered ? '[REGISTERED]' : '[UNREGISTERED]'}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                }}
              >
                <div style={{ color: '#f43f5e', fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>
                  TARGET B: THREAT
                </div>
                <div
                  style={{
                    color: isSecondaryDestroyed ? '#64748b' : '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: isSecondaryDestroyed ? 'line-through' : 'none',
                  }}
                >
                  {secondarySat.name}
                </div>
                <div
                  style={{
                    color: isSecondaryDestroyed ? '#f43f5e' : isSecondaryRegistered ? '#34d399' : '#fbbf24',
                    fontSize: '8px',
                    fontWeight: 700,
                    marginTop: '3px',
                  }}
                >
                  {isSecondaryDestroyed ? '[DESTROYED]' : isSecondaryRegistered ? '[REGISTERED]' : '[UNREGISTERED]'}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#64748b',
                fontSize: '8.5px',
                padding: '2px 0',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                paddingTop: '6px',
              }}
            >
              <span>
                PROJECTED PCA: <span style={{ color: '#f43f5e', fontWeight: 700 }}>&lt; 0.15 KM</span>
              </span>
              <span>
                CONTRACT LISTENER: <span style={{ color: '#38bdf8', fontWeight: 700 }}>ACTIVE</span>
              </span>
            </div>
          </div>
        )}

        {/* 2. SIMULATING: Real-Time Dynamic Approach Telemetry HUD */}
        {simState === 'SIMULATING' && (
          <div
            style={{
              marginBottom: '12px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(2, 6, 18, 0.98) 100%)',
              border: `1px solid ${riskColor}55`,
              borderRadius: '4px',
              padding: '10px 12px',
              fontSize: '9.5px',
              boxShadow: `0 0 20px ${riskColor}20`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={13} style={{ color: riskColor }} />
                <span style={{ color: '#ffffff', fontWeight: 700, letterSpacing: '0.8px' }}>
                  CONJUNCTION TELEMETRY HUD
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: riskColor,
                    boxShadow: `0 0 8px ${riskColor}`,
                  }}
                />
                <span style={{ color: riskColor, fontWeight: 700, fontSize: '8.5px' }}>{currentRiskLevel}</span>
              </div>
            </div>

            {/* Telemetry Metrics 2x2 Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '8px', fontWeight: 600 }}>SEPARATION DISTANCE</div>
                <div style={{ color: riskColor, fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {approachDistanceKm} <span style={{ fontSize: '9px' }}>KM</span>
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '8px', fontWeight: 600 }}>TIME TO CLOSEST APPR.</div>
                <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {timeToPcaSec} <span style={{ fontSize: '9px' }}>S</span>
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '8px', fontWeight: 600 }}>RELATIVE VELOCITY</div>
                <div style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 700 }}>14.28 KM/S</div>
              </div>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '8px', fontWeight: 600 }}>THRESHOLD EVALUATION</div>
                <div
                  style={{
                    color: simProgress >= 0.35 ? '#fbbf24' : '#94a3b8',
                    fontSize: '9.5px',
                    fontWeight: 700,
                  }}
                >
                  {simProgress >= 0.35 ? 'BURN TRIGGERED' : 'MONITORING (<5.0 KM)'}
                </div>
              </div>
            </div>

            {/* Segmented Proximity Progress Scale */}
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#64748b',
                  fontSize: '7.5px',
                  marginBottom: '3px',
                }}
              >
                <span>15.0 KM (ACQUISITION)</span>
                <span>5.0 KM (THRESHOLD)</span>
                <span>0.0 KM (PCA)</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, simProgress * 100))}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #38bdf8 0%, #f59e0b 50%, ${riskColor} 100%)`,
                    boxShadow: `0 0 8px ${riskColor}`,
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
            </div>

            {/* Arbitration Stream Notice */}
            {liabilityText && (
              <div
                style={{
                  padding: '6px 8px',
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '3px',
                  fontSize: '8.5px',
                  color: '#e2e8f0',
                  lineHeight: '1.4',
                }}
              >
                {liabilityText}
              </div>
            )}
          </div>
        )}

        {/* 3. EVADED: Autonomous Avoidance Burn Resolution Card */}
        {simState === 'EVADED' && (
          <div
            style={{
              marginBottom: '12px',
              background: 'linear-gradient(180deg, rgba(6, 78, 59, 0.3) 0%, rgba(2, 44, 34, 0.35) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              borderRadius: '4px',
              padding: '10px 12px',
              fontSize: '9.5px',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} style={{ color: '#34d399' }} />
                <span style={{ color: '#34d399', fontWeight: 700, letterSpacing: '0.8px' }}>
                  MISSION RESOLVED: COLLISION AVERTED
                </span>
              </div>
              <span
                style={{
                  color: '#34d399',
                  fontSize: '8px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                }}
              >
                CLEARED
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <div style={{ color: '#6ee7b7', fontSize: '8px', fontWeight: 600 }}>FINAL SEPARATION</div>
                <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700 }}>2.45 KM</div>
              </div>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <div style={{ color: '#6ee7b7', fontSize: '8px', fontWeight: 600 }}>TACTICAL MANEUVER</div>
                <div style={{ color: '#34d399', fontSize: '10.5px', fontWeight: 700 }}>AUTONOMOUS BURN</div>
              </div>
            </div>

            {liabilityText && (
              <div
                style={{
                  padding: '6px 8px',
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '3px',
                  fontSize: '8.5px',
                  color: '#e2e8f0',
                  lineHeight: '1.4',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '3px',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '8px',
                  }}
                >
                  <Coins size={10} />
                  <span>SMART CONTRACT ARBITRATION RESULT</span>
                </div>
                <div>{liabilityText}</div>
              </div>
            )}

            <div style={{ color: '#94a3b8', fontSize: '8px', lineHeight: '1.4' }}>
              STATUS: Both spacecraft maintain operational integrity. Safe orbital separation restored.
            </div>
          </div>
        )}

        {/* 4. EXPLODED: Critical Casualty & Kinetic Impact Assessment Card */}
        {simState === 'EXPLODED' && (
          <div
            style={{
              marginBottom: '12px',
              background: 'linear-gradient(180deg, rgba(136, 19, 55, 0.35) 0%, rgba(76, 5, 25, 0.4) 100%)',
              border: '1px solid rgba(244, 63, 94, 0.55)',
              borderRadius: '4px',
              padding: '10px 12px',
              fontSize: '9.5px',
              boxShadow: '0 0 25px rgba(244, 63, 94, 0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(244, 63, 94, 0.25)',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Skull size={14} style={{ color: '#f43f5e' }} />
                <span style={{ color: '#fb7185', fontWeight: 700, letterSpacing: '0.8px' }}>
                  CRITICAL: KINETIC IMPACT DETECTED
                </span>
              </div>
              <span
                style={{
                  color: '#f43f5e',
                  fontSize: '8px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '2px',
                  background: 'rgba(244, 63, 94, 0.18)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                }}
              >
                TOTAL LOSS
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                }}
              >
                <div style={{ color: '#fca5a5', fontSize: '8px', fontWeight: 600 }}>SEPARATION AT IMPACT</div>
                <div style={{ color: '#f43f5e', fontSize: '13px', fontWeight: 700 }}>0.00 KM (PCA)</div>
              </div>
              <div
                style={{
                  background: 'rgba(2, 6, 23, 0.75)',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                }}
              >
                <div style={{ color: '#fca5a5', fontSize: '8px', fontWeight: 600 }}>IMPACT ASSESSMENT</div>
                <div style={{ color: '#f43f5e', fontSize: '10.5px', fontWeight: 700 }}>TOTAL DISRUPTION</div>
              </div>
            </div>

            {/* Casualty List */}
            <div
              style={{
                background: 'rgba(2, 6, 23, 0.8)',
                padding: '6px 8px',
                borderRadius: '3px',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                marginBottom: '6px',
              }}
            >
              <div style={{ color: '#fca5a5', fontSize: '8px', fontWeight: 700, marginBottom: '4px' }}>
                ASSET CASUALTIES:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ color: '#e2e8f0', fontSize: '9px', textDecoration: 'line-through' }}>
                  {primarySat.name}
                </span>
                <span style={{ color: '#f43f5e', fontSize: '8px', fontWeight: 700 }}>[DESTROYED]</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e2e8f0', fontSize: '9px', textDecoration: 'line-through' }}>
                  {secondarySat.name}
                </span>
                <span style={{ color: '#f43f5e', fontSize: '8px', fontWeight: 700 }}>[DESTROYED]</span>
              </div>
            </div>

            {/* Insurance / Financial Loss Verdict */}
            <div
              style={{
                padding: '6px 8px',
                background: 'rgba(2, 6, 23, 0.85)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '3px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '2px',
                  color: '#f43f5e',
                  fontWeight: 700,
                  fontSize: '8px',
                }}
              >
                <AlertTriangle size={10} />
                <span>FINANCIAL OUTCOME // PARAMETRIC INSURANCE</span>
              </div>
              <div style={{ color: '#ffffff', fontSize: '9px', fontWeight: 700 }}>
                UNINSURED LOSS: 0.00 ETH PARAMETRIC PAYOUT
              </div>
              <div style={{ color: '#94a3b8', fontSize: '8px', marginTop: '2px' }}>
                Unregistered asset pairing. Incident logged to SQLite audit ledger.
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Enabled for Consecutive Simulations */}
        {simState !== 'SIMULATING' && (
          <button
            onClick={onStartSimulation}
            disabled={isPrimaryDestroyed || isSecondaryDestroyed}
            style={{
              width: '100%',
              background: isPrimaryDestroyed || isSecondaryDestroyed
                ? 'rgba(71, 85, 105, 0.3)'
                : 'linear-gradient(135deg, rgba(225, 29, 72, 0.95) 0%, rgba(159, 18, 57, 0.98) 100%)',
              border: isPrimaryDestroyed || isSecondaryDestroyed
                ? '1px solid rgba(148, 163, 184, 0.2)'
                : '1px solid rgba(244, 63, 94, 0.5)',
              borderRadius: '4px',
              padding: '11px',
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: isPrimaryDestroyed || isSecondaryDestroyed ? 'not-allowed' : 'pointer',
              boxShadow: isPrimaryDestroyed || isSecondaryDestroyed ? 'none' : '0 4px 20px rgba(225, 29, 72, 0.35)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isPrimaryDestroyed && !isSecondaryDestroyed) {
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(225, 29, 72, 0.55)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isPrimaryDestroyed && !isSecondaryDestroyed) {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(225, 29, 72, 0.35)';
              }
            }}
          >
            {isPrimaryDestroyed || isSecondaryDestroyed ? (
              <>
                <Skull size={14} />
                <span>ASSET DESTROYED</span>
              </>
            ) : (
              <>
                <Flame size={14} />
                <span>SIMULATE COLLISION</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default CollisionControlPanel;
