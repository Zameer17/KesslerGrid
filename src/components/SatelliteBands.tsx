import { useMemo } from 'react';
import * as THREE from 'three';

// Newton-Raphson Keplerian solver: solves M = E - e * sin(E)
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

// Computes 3D coordinates along the Keplerian ellipse
function calculateOrbitPoints(
  a: number,
  e: number,
  inclination: number,
  omega: number,
  steps = 128
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const incRad = (inclination * Math.PI) / 180;
  const omegaRad = (omega * Math.PI) / 180;

  const cosInc = Math.cos(incRad);
  const sinInc = Math.sin(incRad);
  const cosOm = Math.cos(omegaRad);
  const sinOm = Math.sin(omegaRad);

  const b = a * Math.sqrt(1 - e * e);

  for (let i = 0; i <= steps; i++) {
    const M = (i * 2 * Math.PI) / steps;
    const E = solveKepler(M, e);

    // Coordinate in orbital plane
    const xp = a * (Math.cos(E) - e);
    const yp = b * Math.sin(E);

    // Rotate into 3D geocentric coordinates
    const x = xp * cosOm - yp * sinOm * cosInc;
    const y = xp * sinOm + yp * cosOm * cosInc;
    const z = yp * sinInc;

    // Convert to Three.js coordinates (X, Y, Z)
    pts.push(new THREE.Vector3(x, z, -y));
  }
  return pts;
}

interface BandConfig {
  name: string;
  a: number;
  e: number;
  inclination: number;
  omega: number;
  color: string;
}

const BANDS: BandConfig[] = [
  { name: 'LEO 400 km', a: 1.15, e: 0.02, inclination: 45, omega: 30, color: '#3e63dd' },
  { name: 'LEO 550 km', a: 1.25, e: 0.05, inclination: 53, omega: 120, color: '#47da84' },
  { name: 'LEO 800 km', a: 1.35, e: 0.03, inclination: 72, omega: 240, color: '#d55033' },
  { name: 'GEO', a: 2.5, e: 0.01, inclination: 5, omega: 0, color: '#eed7a1' },
];

export function SatelliteBands() {
  return (
    <group>
      {BANDS.map((band) => {
        const points = useMemo(() => {
          return calculateOrbitPoints(band.a, band.e, band.inclination, band.omega);
        }, [band.a, band.e, band.inclination, band.omega]);

        const geometry = useMemo(() => {
          return new THREE.BufferGeometry().setFromPoints(points);
        }, [points]);

        return (
          <lineLoop key={band.name} geometry={geometry}>
            <lineBasicMaterial
              color={band.color}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineLoop>
        );
      })}
    </group>
  );
}
