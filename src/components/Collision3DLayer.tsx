import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { SATELLITES, getSatelliteGeocentricPosition } from './Satellite';
import { SOLAR_SYSTEM } from '../data/planets';
import { HelioVector } from 'astronomy-engine';
import { useSolarStore } from '../store/useSolarStore';

interface Collision3DLayerProps {
  primarySatId: string;
  secondarySatId: string;
  simState: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED';
  simProgress: number; // 0.0 to 1.0
  onImpact: () => void;
}

export function Collision3DLayer({
  primarySatId,
  secondarySatId,
  simState,
  simProgress,
  onImpact,
}: Collision3DLayerProps) {
  const particlesRef = useRef<THREE.Points>(null!);
  const shockwaveRef = useRef<THREE.Mesh>(null!);
  const impactTriggered = useRef(false);

  // Compute Earth center in 3D scene coordinates
  const earthPos = useMemo(() => {
    const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
    if (!earth) return new THREE.Vector3(0, 0, 0);
    const simDate = useSolarStore.getState().simDate;
    const helio = HelioVector(earth.astronomyBody, simDate);
    return new THREE.Vector3(
      helio.x * earth.distanceScale,
      helio.z * earth.distanceScale,
      -helio.y * earth.distanceScale
    );
  }, []);

  // Primary and secondary base orbital positions
  const sat1Config = SATELLITES.find((s) => s.id === primarySatId || s.name === primarySatId || s.noradId.toString() === primarySatId) || SATELLITES[0];
  const sat2Config = SATELLITES.find((s) => s.id === secondarySatId || s.name === secondarySatId || s.noradId.toString() === secondarySatId) || SATELLITES[1];

  const pos1Base = getSatelliteGeocentricPosition(sat1Config).add(earthPos);
  const pos2Base = getSatelliteGeocentricPosition(sat2Config).add(earthPos);

  // PCA (Point of Closest Approach) coordinate mid-way between sat1 and sat2
  const pcaPos = useMemo(() => {
    return new THREE.Vector3().addVectors(pos1Base, pos2Base).multiplyScalar(0.5);
  }, [pos1Base, pos2Base]);

  // Current interpolated positions during simulation
  const currentPos1 = useMemo(() => {
    if (simState === 'IDLE') return pos1Base;
    if (simState === 'EVADED') {
      // Offset primary satellite along dodge vector
      const dodgeDir = new THREE.Vector3().subVectors(pos1Base, pos2Base).normalize().multiplyScalar(0.35);
      return new THREE.Vector3().copy(pos1Base).add(dodgeDir);
    }
    // Interpolate toward PCA as simProgress -> 1.0
    return new THREE.Vector3().lerpVectors(pos1Base, pcaPos, Math.min(simProgress, 0.98));
  }, [pos1Base, pos2Base, pcaPos, simState, simProgress]);

  const currentPos2 = useMemo(() => {
    if (simState === 'IDLE') return pos2Base;
    return new THREE.Vector3().lerpVectors(pos2Base, pcaPos, Math.min(simProgress, 0.98));
  }, [pos2Base, pcaPos, simState, simProgress]);

  // Distance telemetry calculation
  const distanceKm = useMemo(() => {
    if (simState === 'EVADED') return 2.45;
    if (simState === 'EXPLODED') return 0.02;
    return Math.max(0.05, (1 - simProgress) * 4.8);
  }, [simState, simProgress]);

  // Check impact threshold
  if (simState === 'SIMULATING' && simProgress >= 0.95 && !impactTriggered.current) {
    impactTriggered.current = true;
    onImpact();
  }

  if (simState === 'IDLE') {
    impactTriggered.current = false;
  }

  // Generate 3D particle positions for realistic explosion
  const particleGeometry = useMemo(() => {
    const count = 350;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorChoices = [
      new THREE.Color('#ef4444'),
      new THREE.Color('#f97316'),
      new THREE.Color('#eab308'),
      new THREE.Color('#38bdf8'),
      new THREE.Color('#ffffff'),
    ];

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 0.05 + Math.random() * 0.25;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      positions[i * 3 + 2] = Math.cos(phi) * speed;

      const c = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  // Frame animation loop for explosion particles and shockwave
  useFrame((_, delta) => {
    if (simState === 'EXPLODED') {
      if (particlesRef.current) {
        particlesRef.current.rotation.y += delta * 0.5;
        particlesRef.current.scale.addScalar(delta * 1.8);
      }
      if (shockwaveRef.current) {
        shockwaveRef.current.scale.addScalar(delta * 2.2);
        const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        if (mat && mat.opacity > 0) {
          mat.opacity = Math.max(0, mat.opacity - delta * 0.6);
        }
      }
    }
  });

  const linePoints = useMemo(() => [currentPos1, currentPos2], [currentPos1, currentPos2]);
  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(linePoints), [linePoints]);

  // Conjunction Risk State Determination
  const riskState = useMemo<'SAFE' | 'APPROACHING' | 'HIGH_RISK' | 'CRITICAL'>(() => {
    if (simState === 'EVADED') return 'SAFE';
    if (distanceKm > 3.8) return 'SAFE';
    if (distanceKm > 2.0) return 'APPROACHING';
    if (distanceKm > 0.8) return 'HIGH_RISK';
    return 'CRITICAL';
  }, [distanceKm, simState]);

  // Color semantics based on risk escalation
  const vectorColor = useMemo(() => {
    if (simState === 'EVADED') return '#10b981';
    switch (riskState) {
      case 'SAFE':
        return '#38bdf8';
      case 'APPROACHING':
        return '#f59e0b';
      case 'HIGH_RISK':
        return '#f97316';
      case 'CRITICAL':
      default:
        return '#f43f5e';
    }
  }, [simState, riskState]);

  const vectorOpacity = useMemo(() => {
    if (simState === 'EVADED') return 0.85;
    switch (riskState) {
      case 'SAFE':
        return 0.55;
      case 'APPROACHING':
        return 0.75;
      case 'HIGH_RISK':
        return 0.9;
      case 'CRITICAL':
      default:
        return 1.0;
    }
  }, [simState, riskState]);

  return (
    <group>
      {/* Dynamic Conjunction Analysis Vector & Pre-Impact Tracking */}
      {(simState === 'SIMULATING' || simState === 'EVADED') && (
        <>
          {/* Tracking Conjunction Vector Line */}
          <lineLoop geometry={lineGeometry}>
            <lineBasicMaterial
              color={vectorColor}
              transparent
              opacity={vectorOpacity}
              linewidth={1}
            />
          </lineLoop>

          {/* Target Bracket: PRIMARY ASSET */}
          <Html position={[currentPos1.x, currentPos1.y, currentPos1.z]} center>
            <div
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'translate3d(0, -22px, 0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '1px 5px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.5)',
                  borderRadius: '2px',
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: '"Space Mono", monospace',
                  color: '#38bdf8',
                  letterSpacing: '0.6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 0 8px rgba(6, 182, 212, 0.3)',
                }}
              >
                <span>[PRI]</span>
                <span>{sat1Config.name}</span>
              </div>
              {/* Corner crosshairs indicator */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  border: '1px dashed rgba(6, 182, 212, 0.6)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </Html>

          {/* Target Bracket: THREAT ASSET */}
          <Html position={[currentPos2.x, currentPos2.y, currentPos2.z]} center>
            <div
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'translate3d(0, -22px, 0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '1px 5px',
                  background: riskState === 'CRITICAL' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  border: `1px solid ${riskState === 'CRITICAL' ? 'rgba(244, 63, 94, 0.6)' : 'rgba(245, 158, 11, 0.6)'}`,
                  borderRadius: '2px',
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: '"Space Mono", monospace',
                  color: riskState === 'CRITICAL' ? '#fb7185' : '#fbbf24',
                  letterSpacing: '0.6px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 8px ${riskState === 'CRITICAL' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                <span>[THREAT]</span>
                <span>{sat2Config.name}</span>
              </div>
              {/* Corner crosshairs indicator */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  border: `1px dashed ${riskState === 'CRITICAL' ? 'rgba(244, 63, 94, 0.7)' : 'rgba(245, 158, 11, 0.7)'}`,
                  borderRadius: '2px',
                }}
              />
            </div>
          </Html>

          {/* Point of Closest Approach (PCA) Measurement Reticle & Proximity Badge */}
          <Html position={[pcaPos.x, pcaPos.y, pcaPos.z]} center>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {/* Technical PCA Cross Reticle */}
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  position: 'relative',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: 0,
                    width: '10px',
                    height: '2px',
                    background: vectorColor,
                    boxShadow: `0 0 6px ${vectorColor}`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '4px',
                    width: '2px',
                    height: '10px',
                    background: vectorColor,
                    boxShadow: `0 0 6px ${vectorColor}`,
                  }}
                />
              </div>

              {/* Separation & Approach Telemetry Pill */}
              <div
                style={{
                  background: simState === 'EVADED'
                    ? 'rgba(6, 78, 59, 0.95)'
                    : riskState === 'CRITICAL'
                    ? 'rgba(159, 18, 57, 0.96)'
                    : riskState === 'HIGH_RISK'
                    ? 'rgba(124, 45, 18, 0.95)'
                    : 'rgba(15, 23, 42, 0.95)',
                  color: '#ffffff',
                  border: `1px solid ${vectorColor}`,
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  fontFamily: '"Space Mono", "JetBrains Mono", monospace',
                  letterSpacing: '0.6px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 0 14px ${vectorColor}66`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {simState === 'EVADED' ? (
                  <span>AVOIDANCE BURN // SEPARATION: 2.45 KM</span>
                ) : (
                  <>
                    <span style={{ color: vectorColor }}>PCA</span>
                    <span>{distanceKm.toFixed(2)} KM</span>
                    <span
                      style={{
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: vectorColor,
                      }}
                    >
                      {riskState}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Html>
        </>
      )}

      {/* 3D Particle Explosion Mesh at PCA */}
      {simState === 'EXPLODED' && (
        <group position={[pcaPos.x, pcaPos.y, pcaPos.z]}>
          <points ref={particlesRef} geometry={particleGeometry}>
            <pointsMaterial
              size={0.06}
              vertexColors
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </points>

          {/* Expanding Shockwave Ring */}
          <mesh ref={shockwaveRef}>
            <sphereGeometry args={[0.08, 32, 32]} />
            <meshBasicMaterial
              color="#ff4500"
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
              wireframe
            />
          </mesh>

          {/* Explosion Telemetry Badge */}
          <Html center position={[0, 0.35, 0]}>
            <div
              style={{
                background: 'rgba(136, 19, 55, 0.96)',
                color: '#ffffff',
                border: '1px solid #f43f5e',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 700,
                fontFamily: '"Space Mono", "JetBrains Mono", monospace',
                letterSpacing: '1px',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 25px rgba(244, 63, 94, 0.8), 0 0 50px rgba(255, 69, 0, 0.4)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              CRITICAL: IMPACT DETECTED AT PCA // KINETIC DISRUPTION
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

export default Collision3DLayer;
