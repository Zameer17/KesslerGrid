import React from 'react';

/**
 * 2D SVG Hardware Overlay for the Collision Analysis Callout & Impact Vector
 * Renders:
 * 1. Stepped technical connector line from PCA to the fixed HUD Context Panel
 * 2. Impact vector line connecting Collision Pair (Asset A <-> PCA <-> Asset B)
 * 3. Precision screen-space reticle marker at PCA (Point of Closest Approach)
 * 4. Technical target brackets for both assets
 * Coordinates and attributes are updated at 60 FPS by CollisionCalloutTracker inside Canvas useFrame.
 */
export const CollisionCalloutOverlay: React.FC = () => {
  return (
    <svg
      id="hud-collision-callout-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 44,
        overflow: 'visible',
        display: 'none',
      }}
    >
      <defs>
        {/* Dynamic Glow Filters */}
        <filter id="hud-collision-cyan-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hud-collision-rose-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1. Thin Impact Vector Line connecting Asset A <-> PCA <-> Asset B */}
      <path
        id="hud-collision-pair-line"
        d="M 0 0"
        stroke="#38bdf8"
        strokeWidth="1"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.8"
      />

      {/* 2. Thin Technical Stepped Connector Line from PCA to HUD Panel */}
      <path
        id="hud-collision-connector-line"
        d="M 0 0"
        stroke="#38bdf8"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
        filter="url(#hud-collision-cyan-glow)"
      />

      {/* 3. Connector Joint Node Dot */}
      <circle
        id="hud-collision-joint"
        cx="0"
        cy="0"
        r="2"
        fill="#030712"
        stroke="#38bdf8"
        strokeWidth="1"
        style={{ display: 'none' }}
      />

      {/* 4. Panel Ingress Terminal Node */}
      <circle
        id="hud-collision-panel-terminal"
        cx="0"
        cy="0"
        r="2.5"
        fill="#38bdf8"
        style={{ display: 'none' }}
      />

      {/* 5. Precision PCA Reference Reticle Marker */}
      <g id="hud-collision-pca-marker" transform="translate(-1000, -1000)">
        {/* Center reticle crosshair ticks */}
        <line x1="-8" y1="0" x2="-2" y2="0" stroke="#f43f5e" strokeWidth="1" />
        <line x1="2" y1="0" x2="8" y2="0" stroke="#f43f5e" strokeWidth="1" />
        <line x1="0" y1="-8" x2="0" y2="-2" stroke="#f43f5e" strokeWidth="1" />
        <line x1="0" y1="2" x2="0" y2="8" stroke="#f43f5e" strokeWidth="1" />

        {/* Diagonal X ticks for PCA reticle */}
        <line x1="-4" y1="-4" x2="4" y2="4" stroke="#f43f5e" strokeWidth="1" />
        <line x1="-4" y1="4" x2="4" y2="-4" stroke="#f43f5e" strokeWidth="1" />

        {/* Central focal circle */}
        <circle
          cx="0"
          cy="0"
          r="3"
          stroke="#f43f5e"
          strokeWidth="1"
          fill="rgba(244, 63, 94, 0.2)"
        />

        {/* PCA Reference Label Badge */}
        <text
          id="hud-pca-title"
          x="0"
          y="-12"
          textAnchor="middle"
          fill="#f43f5e"
          fontSize="8.5"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          letterSpacing="1px"
        >
          PCA
        </text>
        <text
          id="hud-pca-dist"
          x="0"
          y="18"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="8.5"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          letterSpacing="0.8px"
        >
          1.51 KM
        </text>
      </g>

      {/* 6. Target Bracket: Asset A */}
      <g id="hud-collision-asset1-marker" transform="translate(-1000, -1000)">
        <path d="M -10 -10 L -10 -6 M -10 -10 L -6 -10" stroke="#38bdf8" strokeWidth="1" fill="none" />
        <path d="M 10 -10 L 10 -6 M 10 -10 L 6 -10" stroke="#38bdf8" strokeWidth="1" fill="none" />
        <path d="M -10 10 L -10 6 M -10 10 L -6 10" stroke="#38bdf8" strokeWidth="1" fill="none" />
        <path d="M 10 10 L 10 6 M 10 10 L 6 10" stroke="#38bdf8" strokeWidth="1" fill="none" />
        <circle cx="0" cy="0" r="2" fill="#38bdf8" />
        <text
          id="hud-asset1-label"
          x="14"
          y="3"
          fill="#38bdf8"
          fontSize="8"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          letterSpacing="0.6px"
        >
          [ASSET A]
        </text>
      </g>

      {/* 7. Target Bracket: Asset B */}
      <g id="hud-collision-asset2-marker" transform="translate(-1000, -1000)">
        <path d="M -10 -10 L -10 -6 M -10 -10 L -6 -10" stroke="#f59e0b" strokeWidth="1" fill="none" />
        <path d="M 10 -10 L 10 -6 M 10 -10 L 6 -10" stroke="#f59e0b" strokeWidth="1" fill="none" />
        <path d="M -10 10 L -10 6 M -10 10 L -6 10" stroke="#f59e0b" strokeWidth="1" fill="none" />
        <path d="M 10 10 L 10 6 M 10 10 L 6 10" stroke="#f59e0b" strokeWidth="1" fill="none" />
        <circle cx="0" cy="0" r="2" fill="#f59e0b" />
        <text
          id="hud-asset2-label"
          x="14"
          y="3"
          fill="#f59e0b"
          fontSize="8"
          fontFamily="'Space Mono', monospace"
          fontWeight="700"
          letterSpacing="0.6px"
        >
          [ASSET B]
        </text>
      </g>
    </svg>
  );
};

export default CollisionCalloutOverlay;
