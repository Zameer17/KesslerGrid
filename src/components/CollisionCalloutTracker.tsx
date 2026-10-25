import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HelioVector } from 'astronomy-engine';
import { SOLAR_SYSTEM } from '../data/planets';
import { SATELLITES, getSatelliteGeocentricPosition } from './Satellite';
import { useSolarStore } from '../store/useSolarStore';

interface CollisionCalloutTrackerProps {
  primarySatId: string;
  secondarySatId: string;
  simState: 'IDLE' | 'SIMULATING' | 'EVADED' | 'EXPLODED';
  simProgress: number;
}

/**
 * CollisionCalloutTracker runs inside Three.js Canvas frame-loop at 60 FPS.
 * It projects the collision pair and Point of Closest Approach (PCA) to screen space,
 * dynamically updating the 2D hardware SVG connector line, impact vector, and PCA reticle.
 * Zero React re-renders are triggered during animation.
 */
export function CollisionCalloutTracker({
  primarySatId,
  secondarySatId,
  simState,
  simProgress,
}: CollisionCalloutTrackerProps) {
  const { camera } = useThree();

  // Reset SVG overlay on unmount or when hidden
  useEffect(() => {
    return () => {
      const svgEl = document.getElementById('hud-collision-callout-svg');
      if (svgEl) svgEl.style.display = 'none';
    };
  }, []);

  useFrame(() => {
    const svgEl = document.getElementById('hud-collision-callout-svg');
    const connectorLine = document.getElementById('hud-collision-connector-line') as SVGPathElement | null;
    const pairLine = document.getElementById('hud-collision-pair-line') as SVGPathElement | null;
    const jointEl = document.getElementById('hud-collision-joint') as SVGCircleElement | null;
    const terminalEl = document.getElementById('hud-collision-panel-terminal') as SVGCircleElement | null;
    const pcaMarker = document.getElementById('hud-collision-pca-marker') as SVGGElement | null;
    const pcaTitle = document.getElementById('hud-pca-title');
    const pcaDist = document.getElementById('hud-pca-dist');
    const asset1Marker = document.getElementById('hud-collision-asset1-marker') as SVGGElement | null;
    const asset2Marker = document.getElementById('hud-collision-asset2-marker') as SVGGElement | null;
    const asset1Label = document.getElementById('hud-asset1-label');
    const asset2Label = document.getElementById('hud-asset2-label');

    if (!svgEl || !connectorLine || !pairLine || !pcaMarker || !asset1Marker || !asset2Marker) {
      return;
    }

    // 1. Calculate Earth world position
    const earth = SOLAR_SYSTEM.find((p) => p.id === 'earth');
    if (!earth) return;
    const { simDate } = useSolarStore.getState();
    const helio = HelioVector(earth.astronomyBody, simDate);
    const earthPos = new THREE.Vector3(
      helio.x * earth.distanceScale,
      helio.z * earth.distanceScale,
      -helio.y * earth.distanceScale
    );

    // 2. Base positions of target satellites
    const sat1Config =
      SATELLITES.find((s) => s.id === primarySatId || s.name === primarySatId || s.noradId.toString() === primarySatId) ||
      SATELLITES[0];
    const sat2Config =
      SATELLITES.find((s) => s.id === secondarySatId || s.name === secondarySatId || s.noradId.toString() === secondarySatId) ||
      SATELLITES[1];

    const pos1Base = getSatelliteGeocentricPosition(sat1Config).add(earthPos);
    const pos2Base = getSatelliteGeocentricPosition(sat2Config).add(earthPos);
    const pcaPos = new THREE.Vector3().addVectors(pos1Base, pos2Base).multiplyScalar(0.5);

    // Current interpolated positions
    let currentPos1 = pos1Base;
    let currentPos2 = pos2Base;

    if (simState === 'EVADED') {
      const dodgeDir = new THREE.Vector3().subVectors(pos1Base, pos2Base).normalize().multiplyScalar(0.35);
      currentPos1 = new THREE.Vector3().copy(pos1Base).add(dodgeDir);
    } else if (simState === 'SIMULATING' || simState === 'EXPLODED') {
      const t = Math.min(simProgress, 0.98);
      currentPos1 = new THREE.Vector3().lerpVectors(pos1Base, pcaPos, t);
      currentPos2 = new THREE.Vector3().lerpVectors(pos2Base, pcaPos, t);
    }

    // 3. Project 3D positions to 2D Screen Space
    const projPca = pcaPos.clone().project(camera);
    const proj1 = currentPos1.clone().project(camera);
    const proj2 = currentPos2.clone().project(camera);

    // Frustum check: if behind camera plane, hide SVG
    if (projPca.z > 1.0 && proj1.z > 1.0 && proj2.z > 1.0) {
      if (svgEl.style.display !== 'none') svgEl.style.display = 'none';
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const screenPca = {
      x: (projPca.x * 0.5 + 0.5) * width,
      y: (-projPca.y * 0.5 + 0.5) * height,
    };
    const screen1 = {
      x: (proj1.x * 0.5 + 0.5) * width,
      y: (-proj1.y * 0.5 + 0.5) * height,
    };
    const screen2 = {
      x: (proj2.x * 0.5 + 0.5) * width,
      y: (-proj2.y * 0.5 + 0.5) * height,
    };

    // Bounds margin check
    if (
      screenPca.x < -200 ||
      screenPca.x > width + 200 ||
      screenPca.y < -200 ||
      screenPca.y > height + 200
    ) {
      if (svgEl.style.display !== 'none') svgEl.style.display = 'none';
      return;
    }

    // Ensure overlay is visible
    if (svgEl.style.display !== 'block') {
      svgEl.style.display = 'block';
    }

    // 4. Locate Fixed HUD Panel anchor (left edge, upper quadrant)
    const panelEl = document.getElementById('hud-collision-callout-panel');
    let panelAnchorX = width - 360;
    let panelAnchorY = 160;

    if (panelEl) {
      const rect = panelEl.getBoundingClientRect();
      panelAnchorX = rect.left;
      panelAnchorY = rect.top + Math.min(80, rect.height * 0.28);
    }

    // 5. Semantic Color Resolution based on State & Progress
    let semanticColor = '#38bdf8';
    if (simState === 'EXPLODED') {
      semanticColor = '#f43f5e';
    } else if (simState === 'EVADED') {
      semanticColor = '#10b981';
    } else if (simProgress >= 0.85) {
      semanticColor = '#f43f5e';
    } else if (simProgress >= 0.65) {
      semanticColor = '#f97316';
    } else if (simProgress >= 0.35) {
      semanticColor = '#f59e0b';
    } else {
      semanticColor = '#38bdf8';
    }

    // 6. Draw Impact Relationship Line (Asset A <-> PCA <-> Asset B)
    pairLine.setAttribute(
      'd',
      `M ${screen1.x} ${screen1.y} L ${screenPca.x} ${screenPca.y} L ${screen2.x} ${screen2.y}`
    );
    pairLine.setAttribute('stroke', semanticColor);

    // 7. Draw Stepped Technical Connector Line (PCA -> Fixed HUD Panel)
    let connectorPath = '';
    const midX = screenPca.x + (panelAnchorX - screenPca.x) * 0.5;

    if (Math.abs(screenPca.x - panelAnchorX) < 20) {
      // Direct vertical-ish path
      connectorPath = `M ${screenPca.x} ${screenPca.y} L ${panelAnchorX} ${panelAnchorY}`;
      if (jointEl) {
        jointEl.setAttribute('cx', `${(screenPca.x + panelAnchorX) / 2}`);
        jointEl.setAttribute('cy', `${(screenPca.y + panelAnchorY) / 2}`);
        jointEl.setAttribute('stroke', semanticColor);
        jointEl.style.display = 'block';
      }
    } else {
      // Crisp stepped dogleg line
      connectorPath = `M ${screenPca.x} ${screenPca.y} L ${midX} ${screenPca.y} L ${midX} ${panelAnchorY} L ${panelAnchorX} ${panelAnchorY}`;
      if (jointEl) {
        jointEl.setAttribute('cx', `${midX}`);
        jointEl.setAttribute('cy', `${screenPca.y}`);
        jointEl.setAttribute('stroke', semanticColor);
        jointEl.style.display = 'block';
      }
    }

    connectorLine.setAttribute('d', connectorPath);
    connectorLine.setAttribute('stroke', semanticColor);

    if (terminalEl) {
      terminalEl.setAttribute('cx', `${panelAnchorX}`);
      terminalEl.setAttribute('cy', `${panelAnchorY}`);
      terminalEl.setAttribute('fill', semanticColor);
      terminalEl.style.display = 'block';
    }

    // 8. Update PCA Reference Reticle Marker
    pcaMarker.setAttribute('transform', `translate(${screenPca.x}, ${screenPca.y})`);

    let displayDistance = 1.51;
    if (simState === 'EXPLODED') displayDistance = 0.0;
    else if (simState === 'EVADED') displayDistance = 2.45;
    else displayDistance = Math.max(0.05, 15.0 * (1 - simProgress));

    if (pcaDist) {
      pcaDist.textContent = `${displayDistance.toFixed(2)} KM`;
      pcaDist.setAttribute('fill', semanticColor);
    }
    if (pcaTitle) {
      pcaTitle.textContent = simState === 'EXPLODED' ? 'IMPACT POINT' : 'PCA';
      pcaTitle.setAttribute('fill', semanticColor);
    }

    // 9. Update Target Brackets: Asset A and Asset B
    asset1Marker.setAttribute('transform', `translate(${screen1.x}, ${screen1.y})`);
    asset2Marker.setAttribute('transform', `translate(${screen2.x}, ${screen2.y})`);

    if (asset1Label) {
      asset1Label.textContent = `[ASSET A] ${sat1Config.name.toUpperCase()}`;
    }
    if (asset2Label) {
      asset2Label.textContent = `[ASSET B] ${sat2Config.name.toUpperCase()}`;
    }
  });

  return null;
}

export default CollisionCalloutTracker;
