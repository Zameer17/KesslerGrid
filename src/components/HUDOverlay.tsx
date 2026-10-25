import { useSolarStore } from '../store/useSolarStore';
import { SOLAR_SYSTEM } from '../data/planets';
import { NASATimeController } from './NASATimeController';
import { SATELLITES } from './Satellite';
import { Web3StakingModal } from './Web3StakingModal';
import { web3Service } from '../services/web3';
import { CategoryFilterBar } from './CategoryFilterBar';
import { PlanetInfoPanel } from './PlanetInfoPanel';
import { FastTravelDropdown } from './FastTravelDropdown';
import { ExternalLink, Radio, Shield } from 'lucide-react';

import { useState, useEffect } from 'react';

interface HUDOverlayProps {
  isPlanetInfoOpen?: boolean;
  setIsPlanetInfoOpen?: (open: boolean) => void;
}

export function HUDOverlay({ isPlanetInfoOpen: propIsOpen, setIsPlanetInfoOpen: propSetIsOpen }: HUDOverlayProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const isPlanetInfoOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const setIsPlanetInfoOpen = propSetIsOpen || setInternalIsOpen;

  const focusedBody = useSolarStore((s) => s.focusedBody);
  const setFocusedBody = useSolarStore((s) => s.setFocusedBody);

  // Automatically open planet info panel when a planet is selected
  useEffect(() => {
    if (SOLAR_SYSTEM.some((p) => p.id === focusedBody)) {
      setIsPlanetInfoOpen(true);
    } else {
      setIsPlanetInfoOpen(false);
    }
  }, [focusedBody, setIsPlanetInfoOpen]);

  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const conjunctionAlerts = useSolarStore((s) => s.conjunctionAlerts);
  const isWeb3Connected = useSolarStore((s) => s.isWeb3Connected);

  const [pendingBurnId, setPendingBurnId] = useState<string | number | null>(null);
  const [burnToastMsg, setBurnToastMsg] = useState<string | null>(null);

  const handleExecuteAvoidanceBurn = async (alert: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const satId = alert.sat1Id || alert.satA || alert.primary_sat_id || '25544';
    const alertId = alert.id || satId;

    setPendingBurnId(alertId);
    setBurnToastMsg(`[INIT] Connecting MetaMask for on-chain avoidance burn (${satId})...`);

    try {
      if (!isWeb3Connected) {
        await web3Service.connectWallet();
      }

      await web3Service.ensureHardhatNetwork();
      const txHash = await web3Service.executeAvoidanceBurnOnChain(satId);

      setBurnToastMsg(`[CONFIRMED] On-chain avoidance burn confirmed! Tx: ${txHash.slice(0, 14)}...`);
      useSolarStore.getState().addAuditLog(`AUTOMATED GUARD: Parametric avoidance burn executed on-chain for ${satId}.`);

      // Filter resolved alert out of Zustand store
      const currentAlerts = useSolarStore.getState().conjunctionAlerts;
      const updatedAlerts = currentAlerts.filter((a: any) => (a.id || a.sat1Id) !== alertId);
      useSolarStore.getState().setConjunctionAlerts(updatedAlerts);

      setTimeout(() => setBurnToastMsg(null), 5000);
    } catch (err: any) {
      console.error('Avoidance Burn Error:', err);
      const msg = err.reason || err.message || 'Transaction rejected';
      setBurnToastMsg(`[FAILED] Avoidance burn rejected: ${msg}`);
      setTimeout(() => setBurnToastMsg(null), 6000);
    } finally {
      setPendingBurnId(null);
    }
  };

  const currentPlanet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);
  const activeSatellite = SATELLITES.find((s) => s.id === focusedBody);

  // Centralized status resolution from useSolarStore
  const activeSatStatus = useSolarStore((s) => s.getSatelliteStatus(activeSatellite));

  // Match active satellite with backend SQLite registration data for telemetry inspection
  const dbSatRecord = backendSatellites.find((b) => {
    if (!activeSatellite) return false;
    const sNorad = String(activeSatellite.noradId);
    const sName = (activeSatellite.name || '').toLowerCase();
    const sId = (activeSatellite.id || '').toLowerCase();
    return (
      (b.norad_cat_id && String(b.norad_cat_id) === sNorad) ||
      (b.sat_id && b.sat_id.toLowerCase() === sName) ||
      (b.sat_id && b.sat_id.toLowerCase() === sId) ||
      (b.satellite_name && b.satellite_name.toLowerCase() === sName)
    );
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes pulse-live {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #47da84; }
          50% { opacity: 0.65; box-shadow: 0 0 14px #47da84; }
        }
        @keyframes pulse-telemetry {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
        .filter-chip {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .filter-chip:hover {
          transform: translateY(-1.5px);
          background: rgba(255, 255, 255, 0.14) !important;
        }
        .filter-chip:active {
          transform: translateY(0);
        }
      `}</style>

      {/* Top Left Breadcrumb Trail & Web3 Gateway Buttons */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          letterSpacing: '1.5px',
          fontWeight: 600,
          userSelect: 'none',
        }}
      >
        <span
          onClick={() => setFocusedBody('sun')}
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ffffff')}
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.5)')
          }
        >
          SOLAR SYSTEM
        </span>

        {focusedBody === 'moon' ? (
          <>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>›</span>
            <span
              onClick={() => setFocusedBody('earth')}
              style={{
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ffffff')}
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.5)')
              }
            >
              EARTH
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>›</span>
            <span style={{ color: '#e2e8f0' }}>MOON</span>
          </>
        ) : activeSatellite ? (
          <>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>›</span>
            <span
              onClick={() => setFocusedBody('earth')}
              style={{
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ffffff')}
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.5)')
              }
            >
              EARTH
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>›</span>
            <span style={{ color: activeSatellite.orbitColor }}>{activeSatellite.name}</span>
          </>
        ) : (
          focusedBody !== 'sun' && (
            <>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>›</span>
              <span style={{ color: '#ffffff' }}>
                {currentPlanet ? currentPlanet.name.toUpperCase() : focusedBody.toUpperCase()}
              </span>
            </>
          )
        )}

        {/* Professional LIVE DEMO Action Button (Opens demo in new tab) */}
        <a
          href="/demo"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(6, 11, 25, 0.88)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '6px',
            padding: '4px 10px',
            color: '#38bdf8',
            fontFamily: '"Space Mono", monospace, ui-monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            textDecoration: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s ease',
            marginLeft: '8px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(56, 189, 248, 0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#00e5ff';
            e.currentTarget.style.background = 'rgba(14, 165, 233, 0.2)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 229, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            e.currentTarget.style.background = 'rgba(6, 11, 25, 0.88)';
            e.currentTarget.style.color = '#38bdf8';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 10px rgba(56, 189, 248, 0.15)';
          }}
        >
          <Radio size={12} color="#00e5ff" className="animate-pulse" />
          <span>LIVE DEMO</span>
          <ExternalLink size={11} color="rgba(255, 255, 255, 0.7)" />
        </a>
      </div>

      {/* Top Right Live Telemetry Card when Moon is focused */}
      {focusedBody === 'moon' && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            right: '36px',
            background: 'rgba(10, 15, 25, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.3)',
            borderRadius: '10px',
            padding: '16px 20px',
            color: '#e2e8f0',
            fontFamily: '"JetBrains Mono", "SF Mono", monospace, sans-serif',
            fontSize: '11px',
            minWidth: '260px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(226, 232, 240, 0.15)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#e2e8f0',
                  boxShadow: '0 0 8px #e2e8f0',
                  animation: 'pulse-telemetry 1.5s infinite',
                }}
              />
              <span style={{ fontWeight: 700, letterSpacing: '1.5px', color: '#e2e8f0' }}>
                MOON (LUNA)
              </span>
            </div>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px' }}>
              NATURAL SATELLITE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>MEAN DISTANCE</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>384,400 KM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ORBITAL SPEED</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>1.022 KM/S</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ORBIT PERIOD</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>27.32 DAYS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>SURFACE RADIUS</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>1,737.4 KM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ROTATION</span>
              <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '10px' }}>
                TIDALLY LOCKED
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ORBIT STATE</span>
              <span style={{ color: '#47da84', fontWeight: 600 }}>STABLE (GEOCENTRIC)</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Right Live Telemetry Card when any Satellite is focused */}
      {activeSatellite && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            right: '36px',
            background: 'rgba(10, 15, 25, 0.88)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${activeSatellite.orbitColor}66`,
            borderRadius: '10px',
            padding: '16px 20px',
            color: '#e2e8f0',
            fontFamily: '"JetBrains Mono", "SF Mono", monospace, sans-serif',
            fontSize: '11px',
            minWidth: '310px',
            maxWidth: '360px',
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 18px ${activeSatellite.orbitColor}22`,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: activeSatellite.orbitColor,
                  boxShadow: `0 0 8px ${activeSatellite.orbitColor}`,
                  animation: 'pulse-telemetry 1.5s infinite',
                }}
              />
              <span style={{ fontWeight: 700, letterSpacing: '1.2px', color: activeSatellite.orbitColor }}>
                {activeSatellite.name}
              </span>
            </div>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '9px', fontWeight: 600 }}>
              NORAD #{activeSatellite.noradId}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>CATEGORY</span>
              <span style={{ color: activeSatellite.orbitColor, fontWeight: 700, fontSize: '10px' }}>
                {activeSatellite.category.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>OPERATOR / ORIGIN</span>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '10px' }}>{activeSatellite.country}</span>
            </div>

            {/* SQLite & On-Chain Registered Operator Collateral */}
            {dbSatRecord && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>SQLITE STAKE</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    {dbSatRecord.staked_amount_eth} ETH
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>OPERATOR WALLET</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '9px' }}>
                    {dbSatRecord.operator_address.slice(0, 6)}...{dbSatRecord.operator_address.slice(-4)}
                  </span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ALTITUDE</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {activeSatellite.altitudeKm.toFixed(1)} KM
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>VELOCITY</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {(activeSatellite.velocityKmh / 3600).toFixed(2)} KM/S
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>INCLINATION</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeSatellite.inclination.toFixed(2)}°</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>STATUS</span>
              <span style={{
                color: activeSatStatus === 'DESTROYED' ? '#f43f5e' : activeSatStatus === 'REGISTERED' ? '#34d399' : '#94a3b8',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: activeSatStatus === 'DESTROYED' ? '#f43f5e' : activeSatStatus === 'REGISTERED' ? '#34d399' : '#94a3b8',
                  display: 'inline-block'
                }} />
                {activeSatStatus === 'DESTROYED'
                  ? 'DESTROYED (OFFLINE)'
                  : activeSatStatus === 'REGISTERED'
                  ? 'REGISTERED (ON-CHAIN)'
                  : 'UNREGISTERED (ACTIVE)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Center: Planet Information Callout ONLY when a planet is selected */}
      {isPlanetInfoOpen && currentPlanet && focusedBody !== 'sun' && focusedBody !== 'moon' && (
        <PlanetInfoPanel
          planet={currentPlanet}
          onClose={() => setIsPlanetInfoOpen(false)}
        />
      )}

      {/* Top Right: Single Source Fast Travel & Celestial Bodies Control */}
      <FastTravelDropdown
        variant="top-right"
        style={{ top: '24px', right: '36px' }}
        onSelectCallback={(id) => {
          if (SOLAR_SYSTEM.some((p) => p.id === id)) {
            setIsPlanetInfoOpen(true);
          }
        }}
      />

      {/* Bottom Floating Constellation Category Filter & Orbit Toggle Dock */}
      <CategoryFilterBar bottomOffset="96px" />

      {/* Dedicated Left-Side Sci-Fi AI Conjunction Risk Telemetry Panel */}
      {conjunctionAlerts.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            left: '32px',
            width: '360px',
            maxHeight: 'calc(100vh - 210px)',
            background: 'rgba(10, 15, 25, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 16px',
            color: '#e2e8f0',
            fontFamily: '"JetBrains Mono", "SF Mono", monospace, sans-serif',
            fontSize: '11px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(239, 68, 68, 0.15)',
            pointerEvents: 'auto',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'pulse-live 1.2s infinite ease-in-out',
                }}
              />
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '1.2px',
                  color: '#f87171',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Shield size={12} color="#f87171" />
                <span>AI CONJUNCTION MONITOR</span>
              </span>
            </div>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '10px',
                padding: '2px 8px',
              }}
            >
              {conjunctionAlerts.length} THREATS
            </span>
          </div>

          {/* Scrollable Alert Feed Items */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 270px)',
              paddingRight: '4px',
            }}
          >
            {conjunctionAlerts.slice(0, 10).map((alert, idx) => {
              const sat1 =
                alert.sat1Name ?? alert.satA ?? alert.primary_sat_id ?? 'UNKNOWN';
              const sat2 =
                alert.sat2Name ?? alert.satB ?? alert.secondary_sat_id ?? 'UNKNOWN';
              const dist = (alert.missDistanceKm ?? (alert as any).distance ?? 0).toFixed(1);
              const prob = alert.collisionProb
                ? `${(alert.collisionProb * 100).toFixed(1)}%`
                : 'CRITICAL';

              return (
                <div
                  key={alert.id ?? idx}
                  onClick={() => {
                    if (alert.sat1Id) setFocusedBody(`norad_${alert.sat1Id}`);
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  }}
                >
                  {/* Far-Left Prominent Score Badge */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '65px',
                      padding: '4px 6px',
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff' }}>
                      {prob}
                    </span>
                    <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#fca5a5' }}>
                      {dist} KM
                    </span>
                  </div>

                  {/* Middle Intersecting Satellites Info */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#f8fafc' }}>
                      {sat1} <span style={{ color: '#ef4444' }}>↔</span> {sat2}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.55)' }}>
                      STATUS: {alert.slashingTriggered ? 'SLASHED ON-CHAIN' : 'CONJUNCTION ALERT'}
                    </div>
                  </div>

                  {/* Right Web3 Action Button */}
                  <button
                    onClick={(e) => handleExecuteAvoidanceBurn(alert, e)}
                    disabled={pendingBurnId === (alert.id || alert.sat1Id)}
                    style={{
                      fontSize: '8.5px',
                      fontWeight: 700,
                      color: alert.slashingTriggered ? '#10b981' : '#ffffff',
                      background: pendingBurnId === (alert.id || alert.sat1Id)
                        ? 'rgba(56, 189, 248, 0.4)'
                        : alert.slashingTriggered
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(239, 68, 68, 0.75)',
                      border: `1px solid ${
                        pendingBurnId === (alert.id || alert.sat1Id)
                          ? '#38bdf8'
                          : alert.slashingTriggered
                          ? '#10b981'
                          : '#ef4444'
                      }`,
                      borderRadius: '4px',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {pendingBurnId === (alert.id || alert.sat1Id)
                      ? 'EXECUTING BURN...'
                      : alert.slashingTriggered
                      ? 'PROTECTED'
                      : 'EXECUTE BURN'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Left Minimalist Aerospace Status Marker */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(2, 6, 23, 0.70)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)',
          padding: '5px 10px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          userSelect: 'none',
          pointerEvents: 'auto',
          fontFamily: '"Space Mono", monospace',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: '#94a3b8',
        }}
        title="Telemetry Pipeline & SQLite Backend Status"
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 6px #10b981',
          }}
        />
        <span style={{ color: '#cbd5e1' }}>ONLINE</span>
      </div>

      {/* Web3 Avoidance Burn Feedback Banner */}
      {burnToastMsg && (
        <div
          style={{
            position: 'absolute',
            top: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '10px 18px',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '11.5px',
            fontWeight: 700,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.3)',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          {burnToastMsg}
        </div>
      )}

      <NASATimeController />

      {/* Right Side Zoom Controls Widget: Aerospace HUD Glass Frame */}
      <div
        style={{
          position: 'absolute',
          right: '32px',
          bottom: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(2, 6, 23, 0.76)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)',
          padding: '5px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(6, 182, 212, 0.08)',
          pointerEvents: 'auto',
          zIndex: 50,
          fontFamily: '"Space Mono", monospace',
        }}
      >
        <button
          type="button"
          onClick={() => useSolarStore.getState().zoomIn()}
          title="Zoom In (+ / Scroll Up)"
          style={{
            width: '28px',
            height: '28px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
            color: '#f8fafc',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(6, 182, 212, 0.22)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6, 182, 212, 0.6)';
            (e.currentTarget as HTMLElement).style.color = '#22d3ee';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.04)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.1)';
            (e.currentTarget as HTMLElement).style.color = '#f8fafc';
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => useSolarStore.getState().zoomOut()}
          title="Zoom Out (- / Scroll Down)"
          style={{
            width: '28px',
            height: '28px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)',
            color: '#f8fafc',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(6, 182, 212, 0.22)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6, 182, 212, 0.6)';
            (e.currentTarget as HTMLElement).style.color = '#22d3ee';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.04)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.1)';
            (e.currentTarget as HTMLElement).style.color = '#f8fafc';
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setFocusedBody('sun')}
          title="Reset Solar System Overview"
          style={{
            width: '28px',
            height: '20px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%)',
            color: '#94a3b8',
            fontSize: '8px',
            fontFamily: '"Space Mono", monospace',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            letterSpacing: '0.06em',
            marginTop: '2px',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99, 102, 241, 0.2)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.5)';
            (e.currentTarget as HTMLElement).style.color = '#c7d2fe';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
            (e.currentTarget as HTMLElement).style.color = '#94a3b8';
          }}
        >
          RESET
        </button>
      </div>

      {/* Web3 Staking & Audit Logs Glassmorphic Modal */}
      <Web3StakingModal />
    </div>
  );
}