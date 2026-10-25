import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import { HelioVector, GeoVector, Body } from 'astronomy-engine';
import * as THREE from 'three';
import { PlanetDefinition } from '../data/planets';
import { useSolarStore } from '../store/useSolarStore';
import { SatelliteBands } from './SatelliteBands';
import { Satellite } from './Satellite';

// Cloud Layer Subcomponent (unconditional hook call)
function CloudLayer({ texturePath, radius }: { texturePath: string; radius: number }) {
  const cloudsMap = useTexture(texturePath);
  const cloudsRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <mesh ref={cloudsRef}>
      <sphereGeometry args={[radius * 1.018, 64, 64]} />
      <meshStandardMaterial
        map={cloudsMap}
        transparent
        opacity={0.38}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Ring Layer Subcomponent (unconditional hook call)
function RingLayer({
  texturePath,
  ringParams,
}: {
  texturePath: string;
  ringParams: { innerRadius: number; outerRadius: number };
}) {
  const ringsMap = useTexture(texturePath);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[ringParams.innerRadius, ringParams.outerRadius, 64]} />
      <meshStandardMaterial
        map={ringsMap}
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

// Halo Layer Subcomponent for Atmospheric Edge-Glow
function HaloLayer({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh>
      {/* Sphere slightly larger than the planet radius */}
      <sphereGeometry args={[radius * 1.04, 64, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Compute Geocentric Moon position vector in Three.js coordinates
export function getMoonGeocentricPosition(simDate: Date): THREE.Vector3 {
  const geoMoon = GeoVector(Body.Moon, simDate, false);
  const mag = Math.sqrt(geoMoon.x * geoMoon.x + geoMoon.y * geoMoon.y + geoMoon.z * geoMoon.z);
  // Target orbital offset is EarthRadius (1.0) * 8 = 8.0 units
  const targetDist = 8.0;
  const scale = mag > 0 ? targetDist / mag : 3112;

  return new THREE.Vector3(
    geoMoon.x * scale,
    geoMoon.z * scale,
    -geoMoon.y * scale
  );
}

// Lunar Orbit Path Trajectory around Earth
function MoonOrbitLine() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const baseTime = new Date(2000, 0, 1).getTime();
    const steps = 96;
    const stepMs = (27.3216 * 24 * 60 * 60 * 1000) / steps;

    for (let i = 0; i <= steps; i++) {
      const date = new Date(baseTime + i * stepMs);
      pts.push(getMoonGeocentricPosition(date));
    }
    return pts;
  }, []);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        color="#cbd5e1"
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineLoop>
  );
}

// Moon Layer Subcomponent
function MoonLayer() {
  const moonMap = useTexture('/textures/2k_moon.jpg');
  const moonRef = useRef<THREE.Group>(null!);
  const labelRef = useRef<HTMLDivElement>(null!);
  const [isHovered, setIsHovered] = useState(false);

  const showWeb3Modal = useSolarStore((state) => state.showWeb3Modal);
  const showAuditModal = useSolarStore((state) => state.showAuditModal);
  const isCyberDrawerOpen = useSolarStore((state) => state.isCyberDrawerOpen);
  const isModalOpen = showWeb3Modal || showAuditModal || isCyberDrawerOpen;

  const focusedBody = useSolarStore((state) => state.focusedBody);
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);
  const isSelected = focusedBody === 'moon';

  useFrame((state) => {
    if (moonRef.current) {
      const simDate = useSolarStore.getState().simDate;
      const moonPos = getMoonGeocentricPosition(simDate);
      moonRef.current.position.copy(moonPos);

      // Occlusion and smooth fading for Moon reticle label
      const camPos = state.camera.position;
      const worldMoonPos = new THREE.Vector3();
      moonRef.current.getWorldPosition(worldMoonPos);
      const dist = camPos.distanceTo(worldMoonPos);

      let opacity = 1;
      if (dist < 0.9 || isModalOpen) {
        opacity = 0;
      } else if (dist < 1.3) {
        opacity = (dist - 0.9) / (1.3 - 0.9);
      } else if (dist > 45) {
        opacity = Math.max(0, 1 - (dist - 45) / 20);
      }

      if (labelRef.current) {
        labelRef.current.style.opacity = opacity.toFixed(2);
        labelRef.current.style.pointerEvents = opacity === 0 ? 'none' : 'auto';
      }
    }
  }, -1);

  return (
    <group>
      <MoonOrbitLine />
      <group ref={moonRef}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            setFocusedBody('moon');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setIsHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setIsHovered(false);
          }}
        >
          <sphereGeometry args={[0.27, 32, 32]} />
          <meshStandardMaterial map={moonMap} roughness={0.9} />
        </mesh>

        {/* Interactive NASA-Style Reticle Label for Moon (Hidden when modal is open) */}
        {!isModalOpen && (
          <Html center position={[0, 0.42, 0]} zIndexRange={[15, 0]}>
            <div
              ref={labelRef}
              onClick={(e) => {
                e.stopPropagation();
                setFocusedBody('moon');
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                fontFamily: '"Inter", -apple-system, sans-serif',
                textTransform: 'uppercase',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Reticle */}
              <div
                style={{
                  position: 'relative',
                  width: isSelected ? '14px' : (isHovered ? '12px' : '10px'),
                  height: isSelected ? '14px' : (isHovered ? '12px' : '10px'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '1.5px solid',
                    borderColor: isSelected
                      ? '#cbd5e1'
                      : (isHovered ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.4)'),
                    boxShadow: isSelected ? '0 0 8px #cbd5e1' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
                <div
                  style={{
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: isSelected
                      ? '#ffffff'
                      : (isHovered ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)'),
                    boxShadow: isSelected ? '0 0 6px #ffffff' : 'none',
                  }}
                />
              </div>

              {/* Label text */}
              <div
                style={{
                  fontSize: '9px',
                  letterSpacing: '1.2px',
                  fontWeight: 600,
                  color: isSelected
                    ? '#ffffff'
                    : (isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'),
                  textShadow: isSelected
                    ? '0 0 8px #ffffff, 1px 1px 2px rgba(0,0,0,0.8)'
                    : '1px 1px 2px rgba(0,0,0,0.8)',
                  transition: 'all 0.3s ease',
                }}
              >
                MOON
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

export function PlanetNode({ data }: { data: PlanetDefinition }) {
  const planetGroupRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const labelRef = useRef<HTMLDivElement>(null!);
  const moonGroupRef = useRef<THREE.Group>(null!);
  const tiltGroupRef = useRef<THREE.Group>(null!);
  const [isHovered, setIsHovered] = useState(false);

  const showWeb3Modal = useSolarStore((state) => state.showWeb3Modal);
  const showAuditModal = useSolarStore((state) => state.showAuditModal);
  const isCyberDrawerOpen = useSolarStore((state) => state.isCyberDrawerOpen);
  const isModalOpen = showWeb3Modal || showAuditModal || isCyberDrawerOpen;

  const focusedBody = useSolarStore((state) => state.focusedBody);
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);

  // Load textures
  const dayMap = useTexture(data.textures.day);

  useFrame((state, delta) => {
    const simDate = useSolarStore.getState().simDate;
    // 1. Astronomy Engine: HelioVector returns (X, Y, Z) in AU
    const helio = HelioVector(data.astronomyBody, simDate);
    
    // Scale AU to Three.js coordinates
    const posX = helio.x * data.distanceScale;
    const posZ = -helio.y * data.distanceScale;
    const posY = helio.z * data.distanceScale;

    if (planetGroupRef.current) {
      planetGroupRef.current.position.set(posX, posY, posZ);

      // Smooth HTML Label Fading & Occlusion based on camera distance
      const camPos = state.camera.position;
      const planetPos = planetGroupRef.current.position;
      const dist = camPos.distanceTo(planetPos);

      // Define thresholds: fade starts at 4.5x visual radius, fully hidden at 3.5x
      const minDistance = data.radius * 3.5;
      const maxDistance = data.radius * 4.5;

      let opacity = 1;
      if (dist < minDistance || isModalOpen) {
        opacity = 0;
      } else if (dist < maxDistance) {
        opacity = (dist - minDistance) / (maxDistance - minDistance);
      }

      if (labelRef.current) {
        labelRef.current.style.opacity = opacity.toFixed(2);
        labelRef.current.style.pointerEvents = opacity === 0 ? 'none' : 'auto';
      }

      // Dynamically toggle moon visibility in close-up mode or when focused
      if (moonGroupRef.current) {
        const showMoon = isSelected || focusedBody === 'moon' || dist < data.radius * 25.0;
        moonGroupRef.current.visible = showMoon;
      }

      // Fixed 1.0 true-to-scale size to eliminate deep space geometric distortion
      if (tiltGroupRef.current) {
        tiltGroupRef.current.scale.setScalar(1.0);
      }
    }

    // 2. Sidereal Rotation around its axial tilt (Calibrated: 1 Earth Day = 5 Minutes = 300 Seconds)
    if (bodyRef.current) {
      const daySeconds = ((data.rotationPeriodHours || 24) / 24) * 300;
      const rotationStep = (delta / daySeconds) * (Math.PI * 2);
      bodyRef.current.rotation.y += rotationStep;
    }
  }, -1);

  const isSelected = focusedBody === data.id;
  const hasAtmosphere = ['earth', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(data.id);

  return (
    <group ref={planetGroupRef}>
      {/* Axial Tilt Wrapper */}
      <group ref={tiltGroupRef} rotation={[0, 0, THREE.MathUtils.degToRad(data.axialTilt)]}>
        {/* Planet Surface Sphere */}
        <mesh
          ref={bodyRef}
          onClick={(e) => {
            e.stopPropagation();
            setFocusedBody(data.id);
          }}
        >
          <sphereGeometry args={[data.radius, 64, 64]} />
          <meshStandardMaterial map={dayMap} roughness={0.7} metalness={0.1} />
        </mesh>

        {/* Dynamic Cloud Layer */}
        {data.textures.clouds && (
          <CloudLayer texturePath={data.textures.clouds} radius={data.radius} />
        )}

        {/* Planetary Rings */}
        {data.textures.rings && data.ringParams && (
          <RingLayer texturePath={data.textures.rings} ringParams={data.ringParams} />
        )}

        {/* Atmospheric Edge-Glow Halo */}
        {hasAtmosphere && (
          <HaloLayer radius={data.radius} color={data.orbitColor} />
        )}
      </group>

      {/* Moon Node */}
      {data.hasMoon && (
        <group ref={moonGroupRef} visible={false}>
          <MoonLayer />
        </group>
      )}

      {/* Satellite Altitude Bands and 3D Satellite Orbiter for Earth */}
      {data.id === 'earth' && (
        <>
          <SatelliteBands />
          <Satellite />
        </>
      )}

      {/* Interactive NASA-style Label (Hidden when modal is open) */}
      {!isModalOpen && (
        <Html center zIndexRange={[15, 0]}>
          <div
            ref={labelRef}
            onClick={() => setFocusedBody(data.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              fontFamily: '"Inter", -apple-system, sans-serif',
              textTransform: 'uppercase',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Circular Target Reticle */}
            <div
              style={{
                position: 'relative',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Outer Ring */}
              <div
                style={{
                  position: 'absolute',
                  width: isSelected ? '16px' : (isHovered ? '14px' : '12px'),
                  height: isSelected ? '16px' : (isHovered ? '14px' : '12px'),
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor: isSelected
                    ? data.orbitColor
                    : (isHovered ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)'),
                  boxShadow: isSelected ? `0 0 8px ${data.orbitColor}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
              {/* Center Dot */}
              <div
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: isSelected
                    ? data.orbitColor
                    : (isHovered ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)'),
                  boxShadow: isSelected ? `0 0 6px ${data.orbitColor}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            </div>

            {/* Text Label */}
            <div
              style={{
                fontSize: '10px',
                letterSpacing: '1.5px',
                fontWeight: 600,
                color: isSelected
                  ? data.orbitColor
                  : (isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.75)'),
                textShadow: isSelected
                  ? `0 0 8px ${data.orbitColor}, 0 0 15px ${data.orbitColor}, 1px 1px 2px rgba(0,0,0,0.8)`
                  : (isHovered ? '0 0 5px rgba(255, 255, 255, 0.5), 1px 1px 2px rgba(0,0,0,0.8)' : '1px 1px 2px rgba(0,0,0,0.8)'),
                transition: 'all 0.3s ease',
              }}
            >
              {data.name}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
