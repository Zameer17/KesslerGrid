import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSolarStore } from '../store/useSolarStore';
import { HelioVector, Body } from 'astronomy-engine';
import * as THREE from 'three';

interface OrbitLineProps {
  astronomyBody: Body;
  distanceScale: number;
  orbitalPeriodDays: number;
  orbitColor: string;
  radius: number;
}

export function OrbitLine({
  astronomyBody,
  distanceScale,
  orbitalPeriodDays,
  orbitColor,
  radius,
}: OrbitLineProps) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null!);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const baseTime = new Date(2000, 0, 1).getTime();
    const steps = 128;
    const stepMs = (orbitalPeriodDays * 24 * 60 * 60 * 1000) / steps;

    for (let i = 0; i < steps; i++) {
      const date = new Date(baseTime + i * stepMs);
      const helio = HelioVector(astronomyBody, date);
      pts.push(
        new THREE.Vector3(
          helio.x * distanceScale,
          helio.z * distanceScale,
          -helio.y * distanceScale
        )
      );
    }
    return pts;
  }, [astronomyBody, distanceScale, orbitalPeriodDays]);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  // Fade out orbit lines dynamically when camera is close to the planet center
  useFrame((state) => {
    if (materialRef.current) {
      const simDate = useSolarStore.getState().simDate;
      const helio = HelioVector(astronomyBody, simDate);
      const posX = helio.x * distanceScale;
      const posY = helio.z * distanceScale;
      const posZ = -helio.y * distanceScale;

      const camPos = state.camera.position;
      const dist = camPos.distanceTo(new THREE.Vector3(posX, posY, posZ));

      const minDistance = radius * 8.0;
      const maxDistance = radius * 12.0;

      let opacity = 0.4;
      if (dist < minDistance) {
        opacity = 0;
      } else if (dist < maxDistance) {
        opacity = 0.4 * ((dist - minDistance) / (maxDistance - minDistance));
      }

      materialRef.current.opacity = opacity;
      materialRef.current.visible = opacity > 0;
    }
  });

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color={new THREE.Color(orbitColor)}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineLoop>
  );
}