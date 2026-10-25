import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HelioVector } from 'astronomy-engine';
import { SOLAR_SYSTEM } from '../data/planets';
import { useSolarStore } from '../store/useSolarStore';

interface PlanetCalloutTrackerProps {
  isOpen: boolean;
}

/**
 * PlanetCalloutTracker runs inside Three.js Canvas frame-loop.
 * It projects the focused planet world coordinates onto screen space every frame at 60 FPS,
 * and updates the 2D SVG connector line and aerospace targeting marker with zero React re-render overhead.
 */
export function PlanetCalloutTracker({ isOpen }: PlanetCalloutTrackerProps) {
  const focusedBody = useSolarStore((state) => state.focusedBody);
  const activePlanet = SOLAR_SYSTEM.find((p) => p.id === focusedBody);

  const { camera } = useThree();

  // Reset SVG when planet changes or closed
  useEffect(() => {
    const svgEl = document.getElementById('hud-planet-callout-svg');
    if (!isOpen || !activePlanet) {
      if (svgEl) svgEl.style.display = 'none';
    }
  }, [isOpen, activePlanet]);

  useFrame(() => {
    const svgEl = document.getElementById('hud-planet-callout-svg');
    const lineEl = document.getElementById('hud-callout-line') as SVGPathElement | null;
    const markerEl = document.getElementById('hud-callout-marker') as SVGGElement | null;
    const jointEl = document.getElementById('hud-callout-joint') as SVGCircleElement | null;
    const markerLabel = document.getElementById('hud-callout-marker-label');
    const markerSub = document.getElementById('hud-callout-marker-sub');

    if (!isOpen || !activePlanet || !svgEl || !lineEl || !markerEl) {
      if (svgEl && svgEl.style.display !== 'none') {
        svgEl.style.display = 'none';
      }
      return;
    }

    // 1. Calculate world position of the planet
    const { simDate } = useSolarStore.getState();
    const helio = HelioVector(activePlanet.astronomyBody, simDate);
    const worldX = helio.x * activePlanet.distanceScale;
    const worldY = helio.z * activePlanet.distanceScale;
    const worldZ = -helio.y * activePlanet.distanceScale;

    const tempVec = new THREE.Vector3(worldX, worldY, worldZ);

    // 2. Project to screen space via current camera matrices
    tempVec.project(camera);

    // Frustum check: if z > 1.0, the body is behind camera view plane
    if (tempVec.z > 1.0) {
      if (svgEl.style.display !== 'none') svgEl.style.display = 'none';
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const screenX = (tempVec.x * 0.5 + 0.5) * width;
    const screenY = (-tempVec.y * 0.5 + 0.5) * height;

    // Viewport margin check (allow slight offscreen margin before cutting off)
    if (screenX < -150 || screenX > width + 150 || screenY < -150 || screenY > height + 150) {
      if (svgEl.style.display !== 'none') svgEl.style.display = 'none';
      return;
    }

    // Display the SVG overlay
    if (svgEl.style.display !== 'block') {
      svgEl.style.display = 'block';
    }

    // 3. Locate Top-Center HUD Information Panel anchor (bottom center)
    const panelEl = document.getElementById('hud-planet-info-panel');
    let panelX = width / 2;
    let panelY = 220;

    if (panelEl) {
      const rect = panelEl.getBoundingClientRect();
      panelX = rect.left + rect.width / 2;
      panelY = rect.bottom;
    }

    // 4. Target Marker Boundary Anchor
    const targetBracketRadius = 15;
    const targetY = screenY > panelY ? screenY - targetBracketRadius : screenY + targetBracketRadius;

    // 5. Draw Dynamic 1px Stepped Aerospace Callout Line
    let pathD = '';
    const midY = panelY + (screenY - panelY) * 0.42;

    if (Math.abs(screenX - panelX) < 14) {
      // Direct vertical path
      pathD = `M ${panelX} ${panelY} L ${screenX} ${targetY}`;
      if (jointEl) {
        jointEl.setAttribute('cx', `${screenX}`);
        jointEl.setAttribute('cy', `${(panelY + targetY) / 2}`);
        jointEl.style.display = 'block';
      }
    } else {
      // Stepped aerospace dogleg line
      pathD = `M ${panelX} ${panelY} L ${panelX} ${midY} L ${screenX} ${midY} L ${screenX} ${targetY}`;
      if (jointEl) {
        jointEl.setAttribute('cx', `${screenX}`);
        jointEl.setAttribute('cy', `${midY}`);
        jointEl.style.display = 'block';
      }
    }

    lineEl.setAttribute('d', pathD);

    // 6. Update Target Marker screen transform
    markerEl.setAttribute('transform', `translate(${screenX}, ${screenY})`);

    if (markerLabel) {
      markerLabel.textContent = `TARGET LOCK // ${activePlanet.name.toUpperCase()}`;
    }
    if (markerSub) {
      markerSub.textContent = `RANGE: ${activePlanet.distanceScale} AU-x | TILT: ${activePlanet.axialTilt}°`;
    }
  });

  return null;
}

export default PlanetCalloutTracker;
