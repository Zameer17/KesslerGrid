import { Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SOLAR_SYSTEM } from '../data/planets';
import { PlanetNode } from './PlanetNode';
import { OrbitLine } from './OrbitLine';
import { CameraController } from './CameraController';
import { useSolarStore } from '../store/useSolarStore';
import { HUDOverlay } from './HUDOverlay';
import { ErrorBoundary } from './ErrorBoundary';
import { PlanetCalloutTracker } from './PlanetCalloutTracker';
import { PlanetCalloutOverlay } from './PlanetCalloutOverlay';

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

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px' }}>
        INITIALIZING ORBITAL TELEMETRY...
      </div>
    </Html>
  );
}

export default function SolarSystemScene() {
  const focusedBody = useSolarStore((state) => state.focusedBody);
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);
  const [isPlanetInfoOpen, setIsPlanetInfoOpen] = useState<boolean>(true);

  // Re-open callout panel when a planet is selected
  useEffect(() => {
    if (SOLAR_SYSTEM.some((p) => p.id === focusedBody)) {
      setIsPlanetInfoOpen(true);
    } else {
      setIsPlanetInfoOpen(false);
    }
  }, [focusedBody]);

  return (
    <div
      onDoubleClick={() => setFocusedBody('sun')}
      style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}
    >
      <ErrorBoundary fallbackTitle="3D Scene Engine Error">
        <Canvas
          camera={{ position: [0, 50, 110], fov: 45, near: 0.1, far: 2000 }}
        >
          <ambientLight intensity={0.25} />
          <hemisphereLight args={['#d0e6ff', '#0f172a', 0.4]} />
          <TimeManager />

          <Suspense fallback={<Loader />}>
            <BackgroundEnvironment />
            <Sun />
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

          {/* Real-time 60fps screen-space tracker for the dynamic connector line and target marker */}
          <PlanetCalloutTracker isOpen={isPlanetInfoOpen} />
        </Canvas>
      </ErrorBoundary>

      {/* 2D Hardware SVG Callout Line & Aerospace Reticle Overlay */}
      <PlanetCalloutOverlay />

      <ErrorBoundary fallbackTitle="HUD Interface Overlay Error">
        <HUDOverlay
          isPlanetInfoOpen={isPlanetInfoOpen}
          setIsPlanetInfoOpen={setIsPlanetInfoOpen}
        />
      </ErrorBoundary>
    </div>
  );
}