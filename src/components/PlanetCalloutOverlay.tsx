import React from 'react';

/**
 * 2D SVG Overlay for the Aerospace HUD Callout
 * Renders the 1px dynamic connector line, joint marker, and precision targeting bracket.
 * Coordinates are updated dynamically in real-time by PlanetCalloutTracker inside Canvas useFrame.
 */
export const PlanetCalloutOverlay: React.FC = () => {
  return (
    <svg
      id="hud-planet-callout-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 42,
        overflow: 'visible',
        display: 'none',
      }}
    >
      <defs>
        {/* Subtle Cyan Aerospace Glow Filter */}
        <filter id="hud-cyan-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1px Thin Dynamic Aerospace Connector Line */}
      <path
        id="hud-callout-line"
        d="M 0 0"
        stroke="#00e5ff"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
        filter="url(#hud-cyan-glow)"
      />

      {/* Subtle Aerospace Joint Marker Dot */}
      <circle
        id="hud-callout-joint"
        cx="0"
        cy="0"
        r="2.5"
        fill="#030712"
        stroke="#00e5ff"
        strokeWidth="1"
        style={{ display: 'none' }}
      />

      {/* Dynamic Screen-Space Target Marker (Follows Selected Planet) */}
      <g id="hud-callout-marker" transform="translate(-1000, -1000)">
        {/* Four Precision Aerospace Corner Brackets (28px span) */}
        {/* Top-Left Bracket */}
        <path
          d="M -14 -14 L -14 -8 M -14 -14 L -8 -14"
          stroke="#00e5ff"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="square"
        />
        {/* Top-Right Bracket */}
        <path
          d="M 14 -14 L 14 -8 M 14 -14 L 8 -14"
          stroke="#00e5ff"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="square"
        />
        {/* Bottom-Left Bracket */}
        <path
          d="M -14 14 L -14 8 M -14 14 L -8 14"
          stroke="#00e5ff"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="square"
        />
        {/* Bottom-Right Bracket */}
        <path
          d="M 14 14 L 14 8 M 14 14 L 8 14"
          stroke="#00e5ff"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="square"
        />

        {/* Reticle Crosshair Ticks */}
        <line x1="-5" y1="0" x2="-2" y2="0" stroke="#38bdf8" strokeWidth="1" />
        <line x1="2" y1="0" x2="5" y2="0" stroke="#38bdf8" strokeWidth="1" />
        <line x1="0" y1="-5" x2="0" y2="-2" stroke="#38bdf8" strokeWidth="1" />
        <line x1="0" y1="2" x2="0" y2="5" stroke="#38bdf8" strokeWidth="1" />

        {/* Central Locator Ring */}
        <circle
          cx="0"
          cy="0"
          r="3.5"
          stroke="#00e5ff"
          strokeWidth="1"
          fill="rgba(0, 229, 255, 0.15)"
        />

        {/* Line Termination Node (Top of Bracket) */}
        <circle
          cx="0"
          cy="-14"
          r="1.5"
          fill="#00e5ff"
        />

        {/* Aerospace Identification Label Tag */}
        <text
          id="hud-callout-marker-label"
          x="18"
          y="-6"
          fill="#00e5ff"
          fontSize="9"
          fontFamily="'Space Mono', monospace, ui-monospace"
          fontWeight="700"
          letterSpacing="1px"
          opacity="0.9"
        >
          TARGET ACQUIRED
        </text>
        <text
          id="hud-callout-marker-sub"
          x="18"
          y="5"
          fill="rgba(255, 255, 255, 0.55)"
          fontSize="7.5"
          fontFamily="'Space Mono', monospace, ui-monospace"
          letterSpacing="0.8px"
        >
          HUD TRACKING
        </text>
      </g>
    </svg>
  );
};

export default PlanetCalloutOverlay;
