import { Suspense, useEffect, useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SOLAR_SYSTEM } from '../data/planets';
import { PlanetNode } from './PlanetNode';
import { OrbitLine } from './OrbitLine';
import { CameraController } from './CameraController';
import { GlobalSatelliteFleet } from './GlobalSatelliteFleet';
import { useSolarStore } from '../store/useSolarStore';
import { ErrorBoundary } from './ErrorBoundary';
import { CategoryFilterBar } from './CategoryFilterBar';
import { FastTravelDropdown } from './FastTravelDropdown';
import { CollisionControlPanel } from './CollisionControlPanel';
import { Collision3DLayer } from './Collision3DLayer';
import { CollisionCalloutPanel } from './CollisionCalloutPanel';
import { CollisionCalloutOverlay } from './CollisionCalloutOverlay';
import { CollisionCalloutTracker } from './CollisionCalloutTracker';
import { broadcastSatelliteRefresh, broadcastSceneReset, kesslerSyncChannel } from '../services/syncChannel';
import { api } from '../services/api';
import { DebugConsoleOverlay } from './DebugConsoleOverlay';
import { SATELLITES } from './Satellite';
import { API_BASE_URL } from '../services/apiConfig';

function BackgroundEnvironment() {
  const { scene } = useThree();
  const starTexture = useTexture('/textures/8k_stars_milky_way.jpg');

  useEffect(() => {
    starTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = starTexture;
  }, [starTexture, scene]);

  return null;
}

function Sun() {
  const sunTexture = useTexture('/textures/2k_sun.jpg');
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);

  return (
    <mesh onClick={() => setFocusedBody('sun')}>
      <sphereGeometry args={[4.5, 64, 64]} />
      <meshBasicMaterial map={sunTexture} />
      <pointLight position={[0, 0, 0]} intensity={10} decay={0} distance={3000} />
    </mesh>
  );
}

function TimeManager() {
  useFrame((_, delta) => {
    const state = useSolarStore.getState();
    if (state.isPlaying) {
      const msToAdd = delta * 1000 * (state.timeSpeed / 86400) * 86400;
      state.simDate = new Date(state.simDate.getTime() + msToAdd);
    }
  }, -2);

  return null;
}

function SimulationProgressController({
  simState,
  setSimProgress,
}: {
  simState: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED';
  setSimProgress: React.Dispatch<React.SetStateAction<number>>;
}) {
  useFrame((_, delta) => {
    if (simState === 'SIMULATING') {
      setSimProgress((prev) => Math.min(1.0, prev + delta * 0.12));
    }
  });
  return null;
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px' }}>
        INITIALIZING DEMO TELEMETRY...
      </div>
    </Html>
  );
}

export function LiveDemoPage() {
  const [primarySatId, setPrimarySatId] = useState<string>(SATELLITES[0].id);
  const [secondarySatId, setSecondarySatId] = useState<string>(SATELLITES[1].id);
  const [simState, setSimState] = useState<'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED'>('IDLE');
  const [simProgress, setSimProgress] = useState<number>(0);
  const impactInProgress = useRef<boolean>(false);

  // State hydration on mount: fetch current fleet state and audit logs from backend without purging or resetting database
  useEffect(() => {
    document.title = 'Live Collision Demo';
    const hydrateState = async () => {
      try {
        // 1. Hydrate Fleet State
        const updatedFleet = await api.fetchSatellites();
        if (updatedFleet && Array.isArray(updatedFleet)) {
          useSolarStore.getState().setBackendSatellites(updatedFleet);
        }

        // 2. Hydrate Audit Ledger State
        const historicalLogs = await api.fetchAuditLogs();
        if (historicalLogs && Array.isArray(historicalLogs) && historicalLogs.length > 0) {
          useSolarStore.getState().setAuditLogs(historicalLogs);
        }
      } catch (err) {
        console.error("Failed to fetch state on load:", err);
      }
    };
    hydrateState();
  }, []);

  // Listen for cross-tab or cross-drawer scene reset commands
  useEffect(() => {
    const channel = kesslerSyncChannel;
    if (!channel) return;
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === 'RESET_SCENE' || event.data?.type === 'SYSTEM_RESET') {
        impactInProgress.current = false;
        setSimState('IDLE');
        setSimProgress(0);
      }
    };
    channel.addEventListener('message', handleBroadcast);
    return () => {
      channel.removeEventListener('message', handleBroadcast);
    };
  }, []);

  // Handle Start Simulation
  const handleStartSimulation = async () => {
    impactInProgress.current = false;
    setSimState('SIMULATING');
    setSimProgress(0);

    const sat1 = SATELLITES.find((s) => s.id === primarySatId) || SATELLITES[0];
    const sat2 = SATELLITES.find((s) => s.id === secondarySatId) || SATELLITES[1];

    try {
      // Trigger Express Backend database injection endpoint
      if (typeof api.triggerCollision === 'function') {
        await api.triggerCollision({
          primary_sat_id: sat1.id || sat1.noradId.toString(),
          secondary_sat_id: sat2.id || sat2.noradId.toString(),
        });
      } else {
        await fetch('/api/demo/trigger-collision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primary_sat_id: sat1.id || sat1.noradId.toString(),
            secondary_sat_id: sat2.id || sat2.noradId.toString(),
          }),
        });
      }

      if (typeof api.fetchSatellites === 'function') {
        const updatedFleet = await api.fetchSatellites();
        if (updatedFleet && updatedFleet.length > 0) {
          useSolarStore.getState().setBackendSatellites(updatedFleet);
        }
      }
      broadcastSatelliteRefresh();

      useSolarStore.getState().addAuditLog(
        `🚨 DEMO COLLISION INJECTED: Primary ${sat1.name} <-> Threat ${sat2.name} (PCA < 0.15 km)`
      );
    } catch (err) {
      console.warn('Backend trigger notice:', err);
    }
  };

  // Handle Avoidance Burn Executed
  const handleBurnExecuted = async () => {
    setSimState('EVADED');
    if (typeof api.fetchSatellites === 'function') {
      const updatedFleet = await api.fetchSatellites();
      if (updatedFleet && updatedFleet.length > 0) {
        useSolarStore.getState().setBackendSatellites(updatedFleet);
      }
    }
    broadcastSatelliteRefresh();
  };

  // Handle 3D Impact at PCA with SQLite Persistence & Cross-Tab Sync
  const handleImpact = async () => {
    if (impactInProgress.current) return;
    impactInProgress.current = true;

    if (simState === 'SIMULATING') {
      setSimState('EXPLODED');
    }

    const sat1 = SATELLITES.find((s) => s.id === primarySatId) || SATELLITES[0];
    const sat2 = SATELLITES.find((s) => s.id === secondarySatId) || SATELLITES[1];

    console.log("🔴 [COLLISION: TRIGGERED] Assets: ", sat1.name, sat2.name, {
      primary_norad: sat1.noradId,
      threat_norad: sat2.noradId,
    });

    // 1. Prepare event payload for backend SQLite DB & audit_ledger (Upsert logic)
    const eventPayload = {
      primary_id: sat1.id || sat1.name || sat1.noradId.toString(),
      threat_id: sat2.id || sat2.name || sat2.noradId.toString(),
      primary_name: sat1.name,
      threat_name: sat2.name,
      primary_norad: sat1.noradId,
      threat_norad: sat2.noradId,
    };

    try {
      console.log("🔴 [COLLISION: API] Sending audit event to SQLite...", eventPayload);
      const impactRes = await fetch(`${API_BASE_URL}/api/collision/impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      console.log("🔴 [COLLISION: API SUCCESS] Server responded:", impactRes.status);

      if (impactRes.ok) {
        const resData = await impactRes.json();
        console.log("🔴 [COLLISION: API SUCCESS] Result data:", resData);

        if (resData.scenario === 'MUTUAL_AVOIDANCE' || resData.scenario === 'ASYMMETRIC_AVOIDANCE') {
          setSimState('EVADED');
        }

        const markAsDestroyed = useSolarStore.getState().markAsDestroyed;
        if (resData.primaryAsset?.status === 'DESTROYED') {
          markAsDestroyed(sat1.noradId);
          markAsDestroyed(sat1.id);
          markAsDestroyed(sat1.name);
        }
        if (resData.threatAsset?.status === 'DESTROYED') {
          markAsDestroyed(sat2.noradId);
          markAsDestroyed(sat2.id);
          markAsDestroyed(sat2.name);
        }

        // 1. Immediately update in-memory backendSatellites with remaining states
        if (resData.primaryAsset || resData.threatAsset) {
          const currentSats = useSolarStore.getState().backendSatellites || [];
          const pInfo = resData.primaryAsset;
          const tInfo = resData.threatAsset;

          const updatedSats = currentSats.map((s) => {
            const isP = String(s.sat_id) === String(pInfo?.satId) || String(s.norad_cat_id) === String(sat1.noradId) || s.satellite_name === sat1.name;
            const isT = String(s.sat_id) === String(tInfo?.satId) || String(s.norad_cat_id) === String(sat2.noradId) || s.satellite_name === sat2.name;
            if (isP && pInfo) {
              return {
                ...s,
                staked_amount_eth: pInfo.remainingStake,
                staked_eth: pInfo.remainingStake,
                liability_bond_eth: pInfo.remainingLiability,
                liability_penalty_eth: pInfo.remainingLiability,
                operational_status: pInfo.status || 'DESTROYED',
              };
            }
            if (isT && tInfo) {
              return {
                ...s,
                staked_amount_eth: tInfo.remainingStake,
                staked_eth: tInfo.remainingStake,
                liability_bond_eth: tInfo.remainingLiability,
                liability_penalty_eth: tInfo.remainingLiability,
                operational_status: tInfo.status || 'DESTROYED',
              };
            }
            return s;
          });
          useSolarStore.getState().setBackendSatellites(updatedSats);

          // 2. Synchronize Web3 Transaction Ledger: push burn rows for registered assets
          const addWeb3Tx = useSolarStore.getState().addWeb3Transaction;
          if (pInfo && (pInfo.slashedAmount > 0 || pInfo.burnedAmount > 0 || resData.collisionType === 'REGISTERED_VS_REGISTERED')) {
            const isAvoidance = pInfo.action === 'AVOIDANCE_BURN' || (pInfo.burnedAmount > 0 && pInfo.status === 'ACTIVE');
            const burnVal = isAvoidance ? (pInfo.burnedAmount || 2.5) : (pInfo.slashedAmount || 0);
            addWeb3Tx({
              txHash: pInfo.txHash || `0xburn_${Date.now()}_primary`,
              type: isAvoidance ? 'AVOIDANCE BURN' : 'COLLATERAL BURN',
              actionType: isAvoidance ? 'AVOIDANCE BURN' : 'COLLATERAL BURN',
              satelliteName: pInfo.satelliteName || sat1.name,
              noradId: sat1.noradId,
              valueEth: `${Number(burnVal).toFixed(2)} ETH`,
              timestamp: new Date().toLocaleTimeString(),
            });
          }

          if (tInfo && (tInfo.slashedAmount > 0 || tInfo.burnedAmount > 0 || resData.collisionType === 'REGISTERED_VS_REGISTERED')) {
            const isAvoidance = tInfo.action === 'AVOIDANCE_BURN' || (tInfo.burnedAmount > 0 && tInfo.status === 'ACTIVE');
            const burnVal = isAvoidance ? (tInfo.burnedAmount || 2.5) : (tInfo.slashedAmount || 0);
            addWeb3Tx({
              txHash: tInfo.txHash || `0xburn_${Date.now()}_threat`,
              type: isAvoidance ? 'AVOIDANCE BURN' : 'COLLATERAL BURN',
              actionType: isAvoidance ? 'AVOIDANCE BURN' : 'COLLATERAL BURN',
              satelliteName: tInfo.satelliteName || sat2.name,
              noradId: sat2.noradId,
              valueEth: `${Number(burnVal).toFixed(2)} ETH`,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }
      }

      // Immediately refresh global satellite fleet from API and notify all listeners/drawers
      if (typeof api.fetchSatellites === 'function') {
        const updatedFleet = await api.fetchSatellites();
        if (updatedFleet && updatedFleet.length > 0) {
          useSolarStore.getState().setBackendSatellites(updatedFleet);
        }
      } else {
        const satRes = await fetch(`${API_BASE_URL}/api/satellites`);
        if (satRes.ok) {
          const freshSats = await satRes.json();
          const satsArray = Array.isArray(freshSats) ? freshSats : freshSats.data || [];
          if (satsArray.length > 0) {
            useSolarStore.getState().setBackendSatellites(satsArray);
          }
        }
      }

      useSolarStore.getState().addAuditLog(`💀 TOTAL DESTRUCTION: ${sat1.name} & ${sat2.name} destroyed at PCA.`);

      // 3. Fire cross-tab sync to update Main Dashboard and DB Monitor instantly
      broadcastSatelliteRefresh();
    } catch (err) {
      console.error("❌ [COLLISION: ERROR] Failed to persist collision to DB", err);
    }
  };

  // Handle Refresh Demo Button Click with Cross-Tab Concurrency Reset
  const handleRefreshDemo = async () => {
    impactInProgress.current = false;
    setSimState('IDLE');
    setSimProgress(0);

    try {
      // 1. Trigger backend selective demo reset
      const resetUrl = `${API_BASE_URL}/api/demo/reset-state`;
      await fetch(resetUrl, { method: 'POST' }).catch(() => fetch('/api/demo/reset-state', { method: 'POST' }));

      // 2. Call the Zustand clear method to wipe local graveyard
      useSolarStore.getState().clearDestroyed();

      // Fetch latest backend satellites to immediately restore ACTIVE status across store
      const satRes = await fetch(`${API_BASE_URL}/api/satellites`).catch(() => fetch('/api/satellites'));
      if (satRes && satRes.ok) {
        const data = await satRes.json();
        const sats = Array.isArray(data) ? data : data.data || [];
        if (sats.length > 0) {
          useSolarStore.getState().setBackendSatellites(sats);
        }
      }

      // 3. Broadcast to all tabs so they pull the healed database and reset 3D scene
      broadcastSatelliteRefresh();
      broadcastSceneReset();
      useSolarStore.getState().addAuditLog('🔄 DEMO RESET: All destroyed satellites restored to ACTIVE status.');
    } catch (err) {
      console.warn('Reset state note:', err);
      useSolarStore.getState().clearDestroyed();
      broadcastSatelliteRefresh();
      broadcastSceneReset();
    }
  };

  // Render Dynamic Refresh Demo Button inside CategoryFilterBar
  const refreshButtonNode = (simState === 'EVADED' || simState === 'EXPLODED') ? (
    <button
      onClick={handleRefreshDemo}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.25) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.6)',
        borderRadius: '4px',
        padding: '5px 12px',
        color: '#38bdf8',
        fontFamily: '"Space Mono", "JetBrains Mono", monospace',
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)',
        pointerEvents: 'auto',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.9)';
        e.currentTarget.style.color = '#ffffff';
        e.currentTarget.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.6)';
        e.currentTarget.style.color = '#38bdf8';
        e.currentTarget.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.25)';
      }}
    >
      <RefreshCw size={12} />
      <span>RESET TEST SCENE</span>
    </button>
  ) : undefined;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Top Floating Glassmorphic Header & Collision Lifecycle Ribbon */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '7px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {/* Main Title Badge */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(8, 12, 22, 0.95) 0%, rgba(2, 6, 18, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: '4px',
            padding: '6px 18px',
            color: '#ffffff',
            fontFamily: '"Space Mono", "JetBrains Mono", monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.4px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85), 0 0 25px rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#f43f5e',
              boxShadow: '0 0 8px #f43f5e',
            }}
          />
          <span>AUTONOMOUS STM // COLLISION TEST ENVIRONMENT</span>
        </div>

        {/* Collision Lifecycle Pipeline Ribbon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(180deg, rgba(8, 12, 22, 0.94) 0%, rgba(2, 6, 18, 0.97) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '4px',
            padding: '4px 12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
            pointerEvents: 'auto',
            fontFamily: '"Space Mono", "JetBrains Mono", monospace',
            fontSize: '9px',
          }}
        >
          {[
            {
              id: 'TRACKED',
              label: '1. TRACKED',
              isCurrent: simState === 'IDLE',
              isPast: simState !== 'IDLE',
              color: '#38bdf8',
            },
            {
              id: 'CONJUNCTION',
              label: '2. CONJUNCTION',
              isCurrent: simState === 'SIMULATING' && simProgress < 0.5,
              isPast: (simState === 'SIMULATING' && simProgress >= 0.5) || simState === 'EVADED' || simState === 'EXPLODED',
              color: '#f59e0b',
            },
            {
              id: 'PCA',
              label: '3. PCA',
              isCurrent: simState === 'SIMULATING' && simProgress >= 0.5,
              isPast: simState === 'EVADED' || simState === 'EXPLODED',
              color: '#f43f5e',
            },
            {
              id: 'IMPACT',
              label: '4. IMPACT',
              isCurrent: simState === 'EXPLODED',
              isPast: false,
              color: '#e11d48',
            },
            {
              id: 'RESOLVED',
              label: '5. RESOLVED',
              isCurrent: simState === 'EVADED' || simState === 'EXPLODED',
              isPast: false,
              color: simState === 'EVADED' ? '#10b981' : simState === 'EXPLODED' ? '#fb7185' : '#64748b',
            },
          ].map((stage, idx, arr) => (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: stage.isCurrent
                    ? `${stage.color}1c`
                    : stage.isPast
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'transparent',
                  border: stage.isCurrent
                    ? `1px solid ${stage.color}66`
                    : '1px solid transparent',
                  boxShadow: stage.isCurrent ? `0 0 10px ${stage.color}25` : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: stage.isCurrent
                      ? stage.color
                      : stage.isPast
                      ? `${stage.color}99`
                      : '#334155',
                    boxShadow: stage.isCurrent ? `0 0 6px ${stage.color}` : 'none',
                  }}
                />
                <span
                  style={{
                    color: stage.isCurrent
                      ? '#ffffff'
                      : stage.isPast
                      ? '#94a3b8'
                      : '#475569',
                    fontWeight: stage.isCurrent ? 700 : 500,
                    letterSpacing: '0.6px',
                  }}
                >
                  {stage.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <span style={{ color: 'rgba(148, 163, 184, 0.3)', fontSize: '9px', userSelect: 'none' }}>
                  ›
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top-Right Fast Travel Celestial Dropdown */}
      <FastTravelDropdown />

      {/* Context-Aware Floating Collision Control Panel */}
      <CollisionControlPanel
        primarySatId={primarySatId}
        setPrimarySatId={setPrimarySatId}
        secondarySatId={secondarySatId}
        setSecondarySatId={setSecondarySatId}
        simState={simState}
        simProgress={simProgress}
        onStartSimulation={handleStartSimulation}
        onBurnExecuted={handleBurnExecuted}
        onImpact={handleImpact}
        setSimState={setSimState}
      />

      {/* Bottom Category Filter & Orbit Toggle Overlay Bar with Refresh Demo Action */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          zIndex: 40,
          pointerEvents: 'none'
        }}
      >
        <CategoryFilterBar bottomOffset="36px" extraAction={refreshButtonNode} />
      </div>

      <ErrorBoundary fallbackTitle="Demo 3D Scene Engine Error">
        <Canvas camera={{ position: [0, 50, 110], fov: 45, near: 0.1, far: 2000 }}>
          <ambientLight intensity={0.25} />
          <hemisphereLight args={['#d0e6ff', '#0f172a', 0.4]} />
          <TimeManager />
          <SimulationProgressController simState={simState} setSimProgress={setSimProgress} />

          <Suspense fallback={<Loader />}>
            <BackgroundEnvironment />
            <Sun />
            <GlobalSatelliteFleet />

            {/* 3D Collision Vector Line & Particle Explosion Layer */}
            <Collision3DLayer
              primarySatId={primarySatId}
              secondarySatId={secondarySatId}
              simState={simState}
              simProgress={simProgress}
              onImpact={handleImpact}
            />

            {SOLAR_SYSTEM.map((planet) => (
              <group key={planet.id}>
                <OrbitLine
                  astronomyBody={planet.astronomyBody}
                  distanceScale={planet.distanceScale}
                  orbitalPeriodDays={planet.orbitalPeriodDays}
                  orbitColor={planet.orbitColor}
                  radius={planet.radius}
                />
                <PlanetNode data={planet} />
              </group>
            ))}
          </Suspense>

          <CameraController />

          {/* Real-time 60fps screen-space tracker for the collision callout connector and impact vector */}
          <CollisionCalloutTracker
            primarySatId={primarySatId}
            secondarySatId={secondarySatId}
            simState={simState}
            simProgress={simProgress}
          />
        </Canvas>
      </ErrorBoundary>

      {/* 2D Hardware SVG Callout Line & Aerospace Reticle Overlay */}
      <CollisionCalloutOverlay />

      {/* Contextual Collision Information Panel // Event Inspector */}
      <CollisionCalloutPanel
        primarySatId={primarySatId}
        secondarySatId={secondarySatId}
        simState={simState}
        simProgress={simProgress}
      />

      {/* Floating Real-Time Debug Console Overlay */}
      <DebugConsoleOverlay />
    </div>
  );
}

export default LiveDemoPage;
