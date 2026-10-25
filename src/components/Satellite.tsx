import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSolarStore } from '../store/useSolarStore';
import { NORAD_SATELLITES, NoradSatellite } from '../data/noradSatellites';

// Alias for generic compatibility across codebase
export type SatelliteConfig = NoradSatellite;
export const SATELLITES = NORAD_SATELLITES;

// Continuous orbit progress accumulators for each satellite
const satelliteProgress: Record<string, number> = {};

// Spread initial orbit progress based on true Keplerian mean anomaly
NORAD_SATELLITES.forEach((sat) => {
  satelliteProgress[sat.id] = (sat.meanAnomaly / 360.0) % 1.0;
});

export function advanceSatelliteOrbits(delta: number, isPlaying: boolean) {
  if (isPlaying) {
    NORAD_SATELLITES.forEach((sat) => {
      satelliteProgress[sat.id] =
        (satelliteProgress[sat.id] + delta / sat.periodSeconds) % 1.0;
    });
  }
}

export function getSatelliteOrbitProgress(id: string) {
  return satelliteProgress[id] ?? 0;
}

// Keplerian solver: M = E - e * sin(E)
function solveKepler(M: number, e: number): number {
  let E = M;
  const tolerance = 1e-6;
  for (let k = 0; k < 10; k++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < tolerance) break;
  }
  return E;
}

// Compute geocentric position vector relative to Earth center
export function getSatelliteGeocentricPosition(
  config: NoradSatellite,
  progress = satelliteProgress[config.id] ?? 0
): THREE.Vector3 {
  const a = config.semiMajorAxis;
  const e = config.eccentricity;
  const inc = (config.inclination * Math.PI) / 180;
  const raan = (config.raan * Math.PI) / 180;
  const argP = (config.argOfPeriapsis * Math.PI) / 180;

  const meanAnomaly = (progress % 1.0) * Math.PI * 2;

  const E = solveKepler(meanAnomaly, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cosRaan = Math.cos(raan);
  const sinRaan = Math.sin(raan);
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);
  const cosArg = Math.cos(argP);
  const sinArg = Math.sin(argP);

  // Position in orbital plane
  const x1 = xp * cosArg - yp * sinArg;
  const y1 = xp * sinArg + yp * cosArg;

  // 3D transformation into Three.js coordinates
  const x = x1 * cosRaan - y1 * sinRaan * cosInc;
  const y = y1 * sinInc;
  const z = -(x1 * sinRaan + y1 * cosRaan * cosInc);

  return new THREE.Vector3(x, y, z);
}

// Generate orbit trajectory points
export function generateSatelliteOrbitPoints(config: NoradSatellite, steps = 180): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const a = config.semiMajorAxis;
  const e = config.eccentricity;
  const inc = (config.inclination * Math.PI) / 180;
  const raan = (config.raan * Math.PI) / 180;
  const argP = (config.argOfPeriapsis * Math.PI) / 180;

  const cosRaan = Math.cos(raan);
  const sinRaan = Math.sin(raan);
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);
  const cosArg = Math.cos(argP);
  const sinArg = Math.sin(argP);

  for (let i = 0; i <= steps; i++) {
    const M = (i * 2 * Math.PI) / steps;
    const E = solveKepler(M, e);
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

    const x1 = xp * cosArg - yp * sinArg;
    const y1 = xp * sinArg + yp * cosArg;

    const x = x1 * cosRaan - y1 * sinRaan * cosInc;
    const y = y1 * sinInc;
    const z = -(x1 * sinRaan + y1 * cosRaan * cosInc);

    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

// ==========================================
// HIGH-FIDELITY REAL-LIFE PROCEDURAL TEXTURES
// ==========================================

function createBlueSolarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#061325';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 2;
  const rows = 6;
  const gap = 8;
  const cellW = (512 - (cols + 1) * gap) / cols;
  const cellH = (512 - (rows + 1) * gap) / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = gap + c * (cellW + gap);
      const y = gap + r * (cellH + gap);

      const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      grad.addColorStop(0, '#1c4982');
      grad.addColorStop(0.3, '#2563eb');
      grad.addColorStop(0.7, '#1d4ed8');
      grad.addColorStop(1, '#0f2b5c');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cellW, cellH);

      // Cyan grid wires
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, cellW, cellH);

      // Micro busbars
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + cellW * 0.5, y);
      ctx.lineTo(x + cellW * 0.5, y + cellH);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createFoilTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 256);

  const goldGrad = ctx.createLinearGradient(0, 80, 0, 180);
  goldGrad.addColorStop(0, '#d97706');
  goldGrad.addColorStop(0.5, '#fbbf24');
  goldGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 80, 256, 96);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(4, 4, 248, 248);

  // Quilted diamond blanket texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 256);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createPhasedArrayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(128, 128, 115, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = 48 + c * 40;
      const cy = 48 + r * 40;
      if (Math.hypot(cx - 128, cy - 128) < 100) {
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createWhiteThermalTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, 232, 232);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createCarbonFiberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1e293b';
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      if ((x / 8 + y / 8) % 2 === 0) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ==========================================
// 13 EXACT 3D SATELLITE MODELS (FROM REFERENCE DIAGRAM)
// ==========================================

// 1. METEOROLOGICAL SATELLITE (Row 1, #1)
function ModelMeteorological({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.48, 32]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.20, 0.22, 0.05, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      {[-0.08, 0, 0.08].map((x, idx) => (
        <mesh key={idx} position={[x, 0.28, idx === 1 ? -0.06 : 0.04]}>
          <cylinderGeometry args={[0.035, 0.04, 0.06, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0.07, 0.28, -0.06]}>
        <cylinderGeometry args={[0.02, 0.025, 0.09, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 1.45, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <mesh key={idx} position={[dir * 0.76, 0, 0]}>
          <boxGeometry args={[0.62, 0.48, 0.014]} />
          <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// 2. OCEANOGRAPHIC SATELLITE (Row 1, #2)
function ModelOceanographic({
  foilMap,
  blueSolarMap,
  carbonMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
  carbonMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.30, 0.28, 0.30]} />
        <meshStandardMaterial map={carbonMap} color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.20, 0.22, 0.24, 24]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.9} roughness={0.2} />
      </mesh>
      <group position={[-0.22, -0.05, 0.12]} rotation={[0.4, 0.3, 0.7]}>
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.05, 0.10, 24, 1, true]} />
          <meshStandardMaterial color="#ffffff" metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, 0.08, 0]} rotation={[0.35, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.30, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.48, 0, 0]}>
            <boxGeometry args={[0.50, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 3. TETHER SATELLITES (Row 1, #3)
function ModelTether({ blueSolarMap }: { blueSolarMap: THREE.Texture }) {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 1.25, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.12]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.25} />
      </mesh>
      <group position={[-0.62, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.132, 0]}>
          <boxGeometry args={[0.24, 0.005, 0.24]} />
          <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.132]}>
          <boxGeometry args={[0.24, 0.24, 0.005]} />
          <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[0.62, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color="#334155" metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.132, 0]}>
          <boxGeometry args={[0.24, 0.005, 0.24]} />
          <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.132]}>
          <boxGeometry args={[0.24, 0.24, 0.005]} />
          <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// 4. SPACE STATION (Row 1, #4)
function ModelStation({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.42, 24]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.18, 24]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.85} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.22, -0.05, 0]} rotation={[0.2, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.58, 0.48, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.20, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.95, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
        {[-1, 1].map((dir, idx) => (
          <mesh key={idx} position={[0, dir * 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.42, 0.38, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.45} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 5. BIOSATELLITE (Row 1, #5)
function ModelBiosatellite({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.14, 0.28, 0.22, 6]} />
        <meshStandardMaterial map={whiteMap} color="#f8fafc" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.30, 6]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.25, 0.20, 0.16, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.3} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.28, -0.05, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.46, 0, 0]}>
            <boxGeometry args={[0.48, 0.42, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 6. COMMUNICATION SATELLITE (Row 2, #1)
function ModelCommunication({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.46, 24]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.75} roughness={0.25} />
      </mesh>
      <group position={[0, 0.28, 0]}>
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.08, 0.16, 24, 1, true]} />
          <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.36, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.58, 0, 0]}>
            <boxGeometry args={[0.66, 0.48, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.25} metalness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 7. RECONNAISSANCE SATELLITE (Row 2, #2)
function ModelReconnaissance({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.34]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.85} roughness={0.2} />
      </mesh>
      <group position={[0, 0.28, 0]} rotation={[0.4, 0.5, 0]}>
        <mesh position={[0, 0.10, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.20, 0.04, 0.08, 20, 1, true]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[0, -0.28, 0]} rotation={[-0.4, -0.5, 0]}>
        <mesh position={[0, -0.10, 0]}>
          <cylinderGeometry args={[0.22, 0.05, 0.09, 20, 1, true]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.20, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.30, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.50, 0, 0]}>
            <boxGeometry args={[0.54, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 8. TELECOMMUNICATIONS SATELLITE (Row 2, #3)
function ModelTelecomRelay({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0.12, -0.05, 0]}>
        <boxGeometry args={[0.26, 0.28, 0.26]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.85} roughness={0.2} />
      </mesh>
      <group position={[-0.32, 0.12, 0]} rotation={[0.2, -0.4, 0.6]}>
        <mesh position={[0, 0.14, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.48, 0.10, 0.22, 32, 1, true]} />
          <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.30, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[0.12 + dir * 0.20, 0, 0]} rotation={[0.25, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.60, 0.46, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.25} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 9. NAVIGATION SATELLITE (Row 2, #4)
function ModelNavigation({
  foilMap,
  blueSolarMap,
  phasedArrayMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
  phasedArrayMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.38]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.20]}>
        <boxGeometry args={[0.26, 0.26, 0.02]} />
        <meshStandardMaterial map={phasedArrayMap} metalness={0.88} roughness={0.2} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.18, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.36, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.58, 0, 0]}>
            <boxGeometry args={[0.66, 0.46, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 10. REMOTE SENSING SATELLITE (Row 2, #5)
function ModelRemoteStar({
  foilMap,
  blueSolarMap,
  whiteMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
  whiteMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.20, 0.32, 24]} />
        <meshStandardMaterial map={whiteMap} color="#f8fafc" metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.22, 16]} />
        <meshStandardMaterial map={foilMap} color="#d97706" metalness={0.9} />
      </mesh>
      {Array.from({ length: 8 }).map((_, idx) => {
        const angle = (idx * Math.PI) / 4;
        return (
          <group key={idx} rotation={[0, 0, angle]}>
            <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.24, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
            </mesh>
            <mesh position={[0.38, 0, 0]}>
              <boxGeometry args={[0.32, 0.16, 0.012]} />
              <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// 11. MINI SATELLITE / CUBESAT (Row 3, #1)
function ModelCubesat({ blueSolarMap }: { blueSolarMap: THREE.Texture }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.26, 0.42, 0.26]} />
        <meshStandardMaterial map={blueSolarMap} metalness={0.8} roughness={0.25} />
      </mesh>
      {[-0.13, 0.13].map((x, xi) =>
        [-0.13, 0.13].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x, 0, z]}>
            <boxGeometry args={[0.02, 0.44, 0.02]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
        ))
      )}
      {[
        { pos: [0.13, -0.21, 0.13], rot: [0.6, 0.8, 0] },
        { pos: [-0.13, -0.21, 0.13], rot: [0.6, -0.8, 0] },
        { pos: [0.13, -0.21, -0.13], rot: [-0.6, 0.8, 0] },
        { pos: [-0.13, -0.21, -0.13], rot: [-0.6, -0.8, 0] },
      ].map((ant, idx) => (
        <mesh key={idx} position={ant.pos as [number, number, number]} rotation={ant.rot as [number, number, number]}>
          <cylinderGeometry args={[0.003, 0.003, 0.38, 6]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// 12. ASTRONOMICAL SATELLITE / HUBBLE (Row 3, #4)
function ModelTelescope({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.20, 0.20, 0.58, 24, 1, true]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0, 0.42, 0]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.06, 24, 1, true]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[0.20, 0.22, 0.22, 24]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.9} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.22, -0.05, 0]} rotation={[0.3, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.30, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.50, 0, 0]}>
            <boxGeometry args={[0.52, 0.44, 0.012]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 13. GAMMA TELESCOPE SATELLITE (Row 3, #5)
function ModelGammaTelescope({
  foilMap,
  blueSolarMap,
  whiteMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
  whiteMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.34, 0.28, 0.34]} />
        <meshStandardMaterial map={whiteMap} color="#f8fafc" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.20, 8]} />
        <meshStandardMaterial map={foilMap} color="#d97706" metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.08, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.20, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.56, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 14. Synthetic Aperture Radar (SAR) Satellite
function ModelRadar({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.38]} />
        <meshStandardMaterial map={whiteMap} color="#f8fafc" metalness={0.8} />
      </mesh>
      <mesh position={[0, -0.22, 0.15]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.85, 0.22, 0.02]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.20, 0.10, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.30, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.46, 0, 0]}>
            <boxGeometry args={[0.48, 0.44, 0.012]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 15. SpaceX Dragon Cargo Capsule (Uploaded Image 2)
function ModelDragonCapsule({
  whiteMap,
  blueSolarMap,
}: {
  whiteMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      {/* Conical Reentry Capsule */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.13, 0.24, 0.30, 24]} />
        <meshStandardMaterial map={whiteMap} color="#ffffff" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Forward Nose Docking Port / Hatch */}
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.06, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 4 RCS Thruster Quad Blocks on Shoulders */}
      {[
        [0.17, 0.10, 0],
        [-0.17, 0.10, 0],
        [0, 0.10, 0.17],
        [0, 0.10, -0.17],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
      ))}
      {/* Black Heat Shield Ring */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.245, 0.245, 0.02, 24]} />
        <meshStandardMaterial color="#090d16" roughness={0.7} />
      </mesh>
      {/* Cylindrical Service Trunk Module */}
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.22, 24]} />
        <meshStandardMaterial map={whiteMap} color="#f1f5f9" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Dual Segmented Blue Solar Wings */}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, -0.14, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.62, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} metalness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 16. Cross-Observation Science Platform (Uploaded Image 1)
function ModelCrossObservation({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      {/* Central Foil & Titanium Bus */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.30, 0.30, 0.30]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.88} roughness={0.2} />
      </mesh>
      {/* Top High-Gain Dish */}
      <group position={[0, 0.24, 0]} rotation={[0.3, 0.2, 0]}>
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.20, 0.04, 0.08, 20, 1, true]} />
          <meshStandardMaterial color="#ffffff" metalness={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Forward Articulated Long Magnetometer Boom */}
      <group position={[0, -0.05, 0.15]} rotation={[0.5, 0.3, 0]}>
        <mesh position={[0, 0, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.85, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.85]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
      </group>
      {/* 4-Wing Asymmetric Cross Array */}
      {/* 2 Long Horizontal Wings */}
      {[-1, 1].map((dir, idx) => (
        <group key={`h-${idx}`} position={[dir * 0.20, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.64, 0.40, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* 2 Perpendicular Vertical Panels */}
      {[-1, 1].map((dir, idx) => (
        <group key={`v-${idx}`} position={[0, dir * 0.20, 0]} rotation={[0, 0, dir === -1 ? Math.PI : 0]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.010, 0.010, 0.24, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <boxGeometry args={[0.36, 0.28, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 17. Geodetic Laser Calibration Satellite (LAGEOS / LARES)
function ModelGeodeticSphere() {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[0.22, 2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Laser Retroreflectors */}
      {[-0.14, 0, 0.14].map((x, xi) =>
        [-0.14, 0, 0.14].map((y, yi) => (
          <mesh key={`${xi}-${yi}`} position={[x, y, 0.18]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.05} />
          </mesh>
        ))
      )}
    </group>
  );
}

// 18. Autonomous In-Orbit Servicing Space Tug (MEV-1 / MEV-2)
function ModelSpaceTug({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      {/* Servicing Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.36, 24]} />
        <meshStandardMaterial map={foilMap} color="#d97706" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Forward Mechanical Capture Collar / Grapple Ring */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 16, 1, true]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Propellant Tanks */}
      {[-0.12, 0.12].map((x, idx) => (
        <mesh key={idx} position={[x, 0, 0.14]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} />
        </mesh>
      ))}
      {/* 2 Solar Array Wings */}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.52, 0, 0]}>
            <boxGeometry args={[0.56, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 19. Geostationary Missile Defense Early Warning Payload (SBIRS GEO)
function ModelEarlyWarning({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      {/* Rectangular Gold Bus */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.30, 0.34, 0.30]} />
        <meshStandardMaterial map={foilMap} color="#fbbf24" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Infrared Sensor Telescope Shroud */}
      <group position={[0, 0.24, 0.08]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, 0.10, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.20, 20]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
      </group>
      {/* Steerable Downlink Dish */}
      <group position={[0, -0.22, 0]} rotation={[-0.4, 0.5, 0]}>
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.04, 0.07, 16, 1, true]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 2 Solar Array Wings */}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.20, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.60, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


// 20. Telecom Parabolic Dish Satellite (Uploaded Image 1)
function ModelTelecomParabolicDish({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.32, 24]} />
        <meshStandardMaterial map={foilMap} color="#e2e8f0" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 20, 1, true]} />
        <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {[
        { pos: [-0.22, 0.12, 0.12], rot: [0.4, -0.5, 0] },
        { pos: [0.22, 0.12, 0.12], rot: [0.4, 0.5, 0] },
        { pos: [-0.22, -0.12, -0.12], rot: [-0.4, -0.5, 0] },
        { pos: [0.22, -0.12, -0.12], rot: [-0.4, 0.5, 0] },
      ].map((dish, idx) => (
        <group key={idx} position={dish.pos as any} rotation={dish.rot as any}>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.02, 0.05, 16, 1, true]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.24, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.55, 0, 0]}>
            <boxGeometry args={[0.62, 0.44, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 21. Octagonal Optical Camera Sensor Satellite (Uploaded Image 2)
function ModelOpticalEarthObservation({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.42, 8]} />
        <meshStandardMaterial map={foilMap} color="#475569" metalness={0.92} roughness={0.15} />
      </mesh>
      <group position={[0, 0, 0.22]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 20]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.01, 20]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>
      <mesh position={[0, 0.23, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
        <meshStandardMaterial color="#020617" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.25, 0, 0]} rotation={[0, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.54, 0, 0]}>
            <boxGeometry args={[0.60, 0.48, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} color="#fbbf24" roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 22. High-Tech Sensor Boom Satellite (Uploaded Image 3)
function ModelHighTechSensorBoom({
  foilMap,
  blueSolarMap,
}: {
  foilMap: THREE.Texture;
  blueSolarMap: THREE.Texture;
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.26, 0.50, 0.26]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.10, 0.14]}>
        <boxGeometry args={[0.20, 0.22, 0.04]} />
        <meshStandardMaterial map={foilMap} color="#d97706" metalness={0.9} roughness={0.2} />
      </mesh>
      <group position={[0, -0.26, 0.08]} rotation={[0.4, 0, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.44, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.02, 0.04, 16, 1, true]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {[-0.06, 0.06].map((x, idx) => (
        <mesh key={idx} position={[x, 0.27, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.07, 0.08, 12, 1, true]} />
          <meshStandardMaterial color="#334155" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[-1, 1].map((dir, idx) => (
        <group key={idx} position={[dir * 0.22, 0.12, 0]} rotation={[0.2, dir === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          <mesh position={[0.52, 0, 0]}>
            <boxGeometry args={[0.58, 0.40, 0.014]} />
            <meshStandardMaterial map={blueSolarMap} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function SatelliteModelMesh({
  modelType,
  textures,
}: {
  modelType: NoradSatellite['modelType'];
  textures: {
    blueSolar: THREE.Texture;
    foil: THREE.Texture;
    phasedArray: THREE.Texture;
    white: THREE.Texture;
    carbon: THREE.Texture;
  };
}) {
  return (
    <>
      {modelType === 'meteorological' && (
        <ModelMeteorological whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'oceanographic' && (
        <ModelOceanographic foilMap={textures.foil} blueSolarMap={textures.blueSolar} carbonMap={textures.carbon} />
      )}
      {modelType === 'tether' && (
        <ModelTether blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'station' && (
        <ModelStation whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'biosatellite' && (
        <ModelBiosatellite whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'communication' && (
        <ModelCommunication whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'reconnaissance' && (
        <ModelReconnaissance whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'telecom_relay' && (
        <ModelTelecomRelay foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'navigation' && (
        <ModelNavigation
          foilMap={textures.foil}
          blueSolarMap={textures.blueSolar}
          phasedArrayMap={textures.phasedArray}
        />
      )}
      {modelType === 'remote_star' && (
        <ModelRemoteStar foilMap={textures.foil} blueSolarMap={textures.blueSolar} whiteMap={textures.white} />
      )}
      {modelType === 'cubesat' && (
        <ModelCubesat blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'telescope' && (
        <ModelTelescope foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'gamma_telescope' && (
        <ModelGammaTelescope foilMap={textures.foil} blueSolarMap={textures.blueSolar} whiteMap={textures.white} />
      )}
      {modelType === 'radar' && (
        <ModelRadar whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'dragon_capsule' && (
        <ModelDragonCapsule whiteMap={textures.white} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'cross_observation' && (
        <ModelCrossObservation foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'geodetic_sphere' && (
        <ModelGeodeticSphere />
      )}
      {modelType === 'space_tug' && (
        <ModelSpaceTug foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'early_warning' && (
        <ModelEarlyWarning foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'telecom_parabolic_dish' && (
        <ModelTelecomParabolicDish foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'optical_earth_obs' && (
        <ModelOpticalEarthObservation foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
      {modelType === 'hitech_sensor_boom' && (
        <ModelHighTechSensorBoom foilMap={textures.foil} blueSolarMap={textures.blueSolar} />
      )}
    </>
  );
}

// Single Orbiting Satellite Instance Component
function SatelliteNode({
  config,
  textures,
}: {
  config: NoradSatellite;
  textures: {
    blueSolar: THREE.Texture;
    foil: THREE.Texture;
    phasedArray: THREE.Texture;
    white: THREE.Texture;
    carbon: THREE.Texture;
  };
}) {
  const satGroupRef = useRef<THREE.Group>(null!);
  const modelWrapperRef = useRef<THREE.Group>(null!);
  const labelRef = useRef<HTMLDivElement>(null!);
  const [isHovered, setIsHovered] = useState(false);

  const focusedBody = useSolarStore((state) => state.focusedBody);
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);
  const showSatelliteOrbits = useSolarStore((state) => state.showSatelliteOrbits);
  const activeCategoryFilter = useSolarStore((state) => state.activeCategoryFilter);

  const showWeb3Modal = useSolarStore((state) => state.showWeb3Modal);
  const showAuditModal = useSolarStore((state) => state.showAuditModal);
  const isCyberDrawerOpen = useSolarStore((state) => state.isCyberDrawerOpen);
  const isModalOpen = showWeb3Modal || showAuditModal || isCyberDrawerOpen;

  // Explicit subscriptions to trigger React Three Fiber re-renders
  const backendSatellites = useSolarStore((state) => state.backendSatellites);
  const destroyedDemoIds = useSolarStore((state) => state.destroyedDemoIds);
  const getSatelliteStatus = useSolarStore((state) => state.getSatelliteStatus);
  const isDestroyed = useMemo(() => {
    return getSatelliteStatus(config) === 'DESTROYED';
  }, [getSatelliteStatus, config, backendSatellites, destroyedDemoIds]);

  const isSelected = focusedBody === config.id;
  const isVisible =
    !isDestroyed &&
    (activeCategoryFilter === 'ALL' ||
      config.categoryId === activeCategoryFilter ||
      isSelected);

  const orbitPoints = useMemo(() => generateSatelliteOrbitPoints(config), [config]);
  const orbitGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(orbitPoints);
  }, [orbitPoints]);

  useFrame((state) => {
    if (!isVisible) return;
    const currentPos = getSatelliteGeocentricPosition(config);

    const progress = getSatelliteOrbitProgress(config.id);
    const nextProgress = (progress + 0.001) % 1.0;
    const nextPos = getSatelliteGeocentricPosition(config, nextProgress);

    if (satGroupRef.current) {
      satGroupRef.current.position.copy(currentPos);

      const velocity = new THREE.Vector3().subVectors(nextPos, currentPos).normalize();
      if (velocity.lengthSq() > 0.0001) {
        const upVector = currentPos.clone().normalize();
        const matrix = new THREE.Matrix4();
        matrix.lookAt(new THREE.Vector3(0, 0, 0), velocity, upVector);
        satGroupRef.current.quaternion.setFromRotationMatrix(matrix);
      }

      const camPos = state.camera.position;
      const worldSatPos = new THREE.Vector3();
      satGroupRef.current.getWorldPosition(worldSatPos);
      const dist = camPos.distanceTo(worldSatPos);

      if (labelRef.current) {
        const isLabelVisible = dist < 50.0 && !isModalOpen;
        labelRef.current.style.opacity = isLabelVisible ? '1' : '0';
        labelRef.current.style.pointerEvents = isLabelVisible ? 'auto' : 'none';
      }

      if (modelWrapperRef.current) {
        const scaleFactor = Math.max(1.0, Math.min(2.2, dist * 0.12));
        modelWrapperRef.current.scale.setScalar(scaleFactor);
      }
    }
  }, -1);

  if (!isVisible) return null;

  return (
    <group>
      {/* 3D Orbit Trajectory Line (Toggled by showSatelliteOrbits or when focused) */}
      {(showSatelliteOrbits || isSelected) && (
        <lineLoop geometry={orbitGeometry}>
          <lineBasicMaterial
            color={new THREE.Color(config.orbitColor)}
            transparent
            opacity={isSelected ? 0.85 : 0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineLoop>
      )}

      {/* Orbiting Satellite Body */}
      <group ref={satGroupRef}>
        <group
          ref={modelWrapperRef}
          onClick={(e) => {
            e.stopPropagation();
            setFocusedBody(config.id);
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
          <group scale={[config.scale, config.scale, config.scale]}>
            <SatelliteModelMesh modelType={config.modelType} textures={textures} />
          </group>
        </group>

        {/* NASA-Style Interactive HUD Reticle Label (Hidden when modal is open) */}
        {!isModalOpen && (
          <Html center position={[0, 0.22, 0]} zIndexRange={[15, 0]}>
            <div
              ref={labelRef}
              onClick={(e) => {
                e.stopPropagation();
                setFocusedBody(config.id);
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
                transition: 'opacity 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Target Reticle */}
              <div
                style={{
                  position: 'relative',
                  width: isSelected ? '13px' : isHovered ? '11px' : '9px',
                  height: isSelected ? '13px' : isHovered ? '11px' : '9px',
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
                      ? config.orbitColor
                      : isHovered
                      ? '#ffffff'
                      : 'rgba(255, 255, 255, 0.4)',
                    boxShadow: isSelected ? `0 0 8px ${config.orbitColor}` : 'none',
                  }}
                />
                <div
                  style={{
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    backgroundColor: config.orbitColor,
                  }}
                />
              </div>

              {/* Label Text */}
              <div
                style={{
                  fontSize: '9px',
                  letterSpacing: '1px',
                  fontWeight: 700,
                  color: isSelected
                    ? config.orbitColor
                    : isHovered
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.85)',
                  textShadow: isSelected
                    ? `0 0 8px ${config.orbitColor}, 1px 1px 2px rgba(0,0,0,0.9)`
                    : '1px 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                {config.name}
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

export function useSatelliteTextures() {
  const blueSolar = useMemo(() => createBlueSolarTexture(), []);
  const foil = useMemo(() => createFoilTexture(), []);
  const phasedArray = useMemo(() => createPhasedArrayTexture(), []);
  const white = useMemo(() => createWhiteThermalTileTexture(), []);
  const carbon = useMemo(() => createCarbonFiberTexture(), []);

  return useMemo(
    () => ({ blueSolar, foil, phasedArray, white, carbon }),
    [blueSolar, foil, phasedArray, white, carbon]
  );
}

// Master Satellite Fleet Component mounted inside Earth in PlanetNode
export function Satellite() {
  const textures = useSatelliteTextures();
  const isFocusMode = useSolarStore((s) => s.isFocusMode);
  const demoFocusPair = useSolarStore((s) => s.demoFocusPair);

  // Explicit subscriptions to trigger React Three Fiber re-renders
  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const destroyedDemoIds = useSolarStore((s) => s.destroyedDemoIds);

  // Strict Deduplication of 3D Satellite Fleet
  const uniqueNoradSatellites = useMemo(() => {
    return Array.from(
      new Map(NORAD_SATELLITES.map((sat) => [sat.noradId || sat.id, sat])).values()
    );
  }, []);

  const getSatelliteStatus = useSolarStore((s) => s.getSatelliteStatus);

  // Explicit filter for active visible satellites (excludes DESTROYED objects)
  const visibleSatellites = useMemo(() => {
    return uniqueNoradSatellites.filter((sat) => {
      // Use central store resolver to determine if the satellite is destroyed
      if (getSatelliteStatus(sat) === 'DESTROYED') {
        return false;
      }

      // Focus Collision Isolation Mode: hide all except selected pair
      if (isFocusMode && demoFocusPair) {
        const isTarget = demoFocusPair.some(
          (id) => id === sat.id || id === sat.name || id === sat.noradId.toString()
        );
        if (!isTarget) return false;
      }

      return true;
    });
  }, [uniqueNoradSatellites, getSatelliteStatus, isFocusMode, demoFocusPair, backendSatellites, destroyedDemoIds]);

  useFrame((_, delta) => {
    const isPlaying = useSolarStore.getState().isPlaying;
    advanceSatelliteOrbits(delta, isPlaying);
  }, -1);

  return (
    <group>
      {/* Satellites rendered strictly as full interactive 3D models */}
      {visibleSatellites.map((sat) => (
        <SatelliteNode key={`3d-sat-${sat.noradId || sat.id}`} config={sat} textures={textures} />
      ))}
    </group>
  );
}
