import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { useSolarStore } from '../store/useSolarStore';
import { SOLAR_SYSTEM } from '../data/planets';
import { HelioVector } from 'astronomy-engine';
import * as THREE from 'three';
import { getSatelliteGeocentricPosition, SATELLITES } from './Satellite';
import { getMoonGeocentricPosition } from './PlanetNode';

export function CameraController() {
  const { gl } = useThree();
  const controlsRef = useRef<CameraControls>(null!);
  const focusedBody = useSolarStore((state) => state.focusedBody);
  const zoomTrigger = useSolarStore((state) => state.zoomTrigger);
  const zoomDirection = useSolarStore((state) => state.zoomDirection);

  // Focus body camera transitions
  useEffect(() => {
    if (!controlsRef.current) return;

    if (focusedBody === 'sun') {
      controlsRef.current.setLookAt(0, 75, 160, 0, 0, 0, true);
    } else if (focusedBody === 'moon') {
      const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
      if (earth) {
        const simDate = useSolarStore.getState().simDate;
        const helio = HelioVector(earth.astronomyBody, simDate);
        const earthX = helio.x * earth.distanceScale;
        const earthY = helio.z * earth.distanceScale;
        const earthZ = -helio.y * earth.distanceScale;

        const moonGeocentric = getMoonGeocentricPosition(simDate);
        const targetX = earthX + moonGeocentric.x;
        const targetY = earthY + moonGeocentric.y;
        const targetZ = earthZ + moonGeocentric.z;

        const camPos = new THREE.Vector3();
        const tgtPos = new THREE.Vector3();
        controlsRef.current.getPosition(camPos);
        controlsRef.current.getTarget(tgtPos);

        const dx = tgtPos.x - camPos.x;
        const dy = tgtPos.y - camPos.y;
        const dz = tgtPos.z - camPos.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const vx = len > 0 ? dx / len : 0;
        const vy = len > 0 ? dy / len : 0;
        const vz = len > 0 ? dz / len : -1;

        const dist = 0.27 * 4.2;

        const targetCamX = targetX - vx * dist;
        const targetCamY = targetY - vy * dist;
        const targetCamZ = targetZ - vz * dist;

        controlsRef.current.setLookAt(
          targetCamX,
          targetCamY,
          targetCamZ,
          targetX,
          targetY,
          targetZ,
          true
        );
      }
    } else {
      const activeSatellite = SATELLITES.find((s) => s.id === focusedBody);
      if (activeSatellite) {
        const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
        if (earth) {
          const simDate = useSolarStore.getState().simDate;
          const helio = HelioVector(earth.astronomyBody, simDate);
          const earthX = helio.x * earth.distanceScale;
          const earthY = helio.z * earth.distanceScale;
          const earthZ = -helio.y * earth.distanceScale;

          const satGeocentric = getSatelliteGeocentricPosition(activeSatellite);
          const targetX = earthX + satGeocentric.x;
          const targetY = earthY + satGeocentric.y;
          const targetZ = earthZ + satGeocentric.z;

          const camPos = new THREE.Vector3();
          const tgtPos = new THREE.Vector3();
          controlsRef.current.getPosition(camPos);
          controlsRef.current.getTarget(tgtPos);

          const dx = tgtPos.x - camPos.x;
          const dy = tgtPos.y - camPos.y;
          const dz = tgtPos.z - camPos.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const vx = len > 0 ? dx / len : 0;
          const vy = len > 0 ? dy / len : 0;
          const vz = len > 0 ? dz / len : -1;

          const dist = 0.55;

          const targetCamX = targetX - vx * dist;
          const targetCamY = targetY - vy * dist;
          const targetCamZ = targetZ - vz * dist;

          controlsRef.current.setLookAt(
            targetCamX,
            targetCamY,
            targetCamZ,
            targetX,
            targetY,
            targetZ,
            true
          );
        }
      } else {
        const planet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);
        if (planet) {
          const simDate = useSolarStore.getState().simDate;
          const helio = HelioVector(planet.astronomyBody, simDate);
          const targetX = helio.x * planet.distanceScale;
          const targetY = helio.z * planet.distanceScale;
          const targetZ = -helio.y * planet.distanceScale;

          const camPos = new THREE.Vector3();
          const tgtPos = new THREE.Vector3();
          controlsRef.current.getPosition(camPos);
          controlsRef.current.getTarget(tgtPos);

          const dx = tgtPos.x - camPos.x;
          const dy = tgtPos.y - camPos.y;
          const dz = tgtPos.z - camPos.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const vx = len > 0 ? dx / len : 0;
          const vy = len > 0 ? dy / len : 0;
          const vz = len > 0 ? dz / len : -1;

          const dist = planet.radius * 3.8;

          const targetCamX = targetX - vx * dist;
          const targetCamY = targetY - vy * dist;
          const targetCamZ = targetZ - vz * dist;

          controlsRef.current.setLookAt(
            targetCamX,
            targetCamY,
            targetCamZ,
            targetX,
            targetY,
            targetZ,
            true
          );
        }
      }
    }
  }, [focusedBody]);

  // Responsive mouse wheel, touch pinch, and keyboard zoom listeners
  useEffect(() => {
    const domElement = gl.domElement;
    if (!domElement) return;

    const handleWheel = (e: WheelEvent) => {
      if (!controlsRef.current) return;
      e.preventDefault();

      const camPos = new THREE.Vector3();
      const tgtPos = new THREE.Vector3();
      controlsRef.current.getPosition(camPos);
      controlsRef.current.getTarget(tgtPos);
      const dist = camPos.distanceTo(tgtPos);

      const zoomStep = Math.min(Math.max(dist * 0.18, 0.04), 85.0);
      const delta = e.deltaY < 0 ? zoomStep : -zoomStep;

      controlsRef.current.dolly(delta, true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!controlsRef.current) return;

      const camPos = new THREE.Vector3();
      const tgtPos = new THREE.Vector3();
      controlsRef.current.getPosition(camPos);
      controlsRef.current.getTarget(tgtPos);
      const dist = camPos.distanceTo(tgtPos);
      const zoomStep = Math.min(Math.max(dist * 0.25, 0.1), 100.0);

      if (e.key === '=' || e.key === '+' || e.key === 'PageUp') {
        e.preventDefault();
        controlsRef.current.dolly(zoomStep, true);
      } else if (e.key === '-' || e.key === '_' || e.key === 'PageDown') {
        e.preventDefault();
        controlsRef.current.dolly(-zoomStep, true);
      }
    };

    domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gl]);

  // Handle on-screen UI Zoom Buttons
  useEffect(() => {
    if (zoomTrigger === 0 || !controlsRef.current) return;
    const camPos = new THREE.Vector3();
    const tgtPos = new THREE.Vector3();
    controlsRef.current.getPosition(camPos);
    controlsRef.current.getTarget(tgtPos);
    const dist = camPos.distanceTo(tgtPos);

    const step = Math.min(Math.max(dist * 0.35, 0.1), 100.0);
    controlsRef.current.dolly(zoomDirection * step, true);
  }, [zoomTrigger, zoomDirection]);

  useFrame(() => {
    if (focusedBody === 'sun' || !controlsRef.current) return;

    if (focusedBody === 'moon') {
      const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
      if (!earth) return;

      const { simDate } = useSolarStore.getState();
      const helio = HelioVector(earth.astronomyBody, simDate);
      const earthX = helio.x * earth.distanceScale;
      const earthY = helio.z * earth.distanceScale;
      const earthZ = -helio.y * earth.distanceScale;

      const moonGeocentric = getMoonGeocentricPosition(simDate);
      const targetX = earthX + moonGeocentric.x;
      const targetY = earthY + moonGeocentric.y;
      const targetZ = earthZ + moonGeocentric.z;

      controlsRef.current.moveTo(targetX, targetY, targetZ, false);
      return;
    }

    const activeSatellite = SATELLITES.find((s) => s.id === focusedBody);
    if (activeSatellite) {
      const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
      if (!earth) return;

      const { simDate } = useSolarStore.getState();
      const helio = HelioVector(earth.astronomyBody, simDate);
      const earthX = helio.x * earth.distanceScale;
      const earthY = helio.z * earth.distanceScale;
      const earthZ = -helio.y * earth.distanceScale;

      const satGeocentric = getSatelliteGeocentricPosition(activeSatellite);
      const targetX = earthX + satGeocentric.x;
      const targetY = earthY + satGeocentric.y;
      const targetZ = earthZ + satGeocentric.z;

      controlsRef.current.moveTo(targetX, targetY, targetZ, false);
      return;
    }

    const planet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);
    if (!planet) return;

    const { simDate } = useSolarStore.getState();
    const helio = HelioVector(planet.astronomyBody, simDate);
    const targetX = helio.x * planet.distanceScale;
    const targetY = helio.z * planet.distanceScale;
    const targetZ = -helio.y * planet.distanceScale;

    controlsRef.current.moveTo(targetX, targetY, targetZ, false);
  }, 0);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.25}
      draggingSmoothTime={0.06}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.5}
      dollySpeed={1.5}
      minDistance={0.05}
      maxDistance={2500}
      infinityDolly={true}
    />
  );
}