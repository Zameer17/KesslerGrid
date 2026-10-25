import React, { useState, useEffect, useRef } from 'react';
import { Orbit, Globe, X, Clock } from 'lucide-react';
import { PlanetDefinition } from '../data/planets';

interface PlanetInfoPanelProps {
  planet: PlanetDefinition;
  onClose: () => void;
}

/**
 * PlanetInfoPanel renders in the TOP-CENTER HUD region.
 * Built with precision aerospace aesthetics matching the CyberDrawer command system.
 * Features a 2-minute auto-close timer that resets upon user interaction.
 */
export const PlanetInfoPanel: React.FC<PlanetInfoPanelProps> = ({ planet, onClose }) => {
  // 2-minute countdown (120 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset timer on planet switch or user interaction
  const resetTimer = () => {
    setSecondsRemaining(120);
  };

  useEffect(() => {
    // Reset on planet change
    resetTimer();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [planet.id, onClose]);

  // Format MM:SS for the subtle auto-close telemetry tag
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isEarth = planet.id === 'earth';
  const IconComponent = isEarth ? Globe : Orbit;

  return (
    <div
      id="hud-planet-info-panel"
      onMouseMove={resetTimer}
      onMouseEnter={resetTimer}
      onClick={resetTimer}
      onWheel={resetTimer}
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 48,
        width: 'min(390px, 92vw)',
        background: 'rgba(6, 11, 25, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${planet.orbitColor}55`,
        borderTop: `2px solid ${planet.orbitColor}`,
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
        padding: '14px 18px',
        color: '#e2e8f0',
        fontFamily: '"Space Mono", monospace, ui-monospace',
        fontSize: '11px',
        boxShadow: `0 16px 48px rgba(0, 0, 0, 0.85), 0 0 24px ${planet.orbitColor}25`,
        pointerEvents: 'auto',
        userSelect: 'none',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '8px',
        }}
      >
        {/* Left: Vector Glyph + Target Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${planet.orbitColor}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: planet.orbitColor,
            }}
          >
            <IconComponent size={14} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, letterSpacing: '1.5px', color: planet.orbitColor, fontSize: '12px' }}>
                {planet.name.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.8px',
                }}
              >
                {isEarth ? 'TERRESTRIAL (FLEET HUB)' : 'PLANET'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Auto-Close Countdown & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Subtle Auto-Close Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'rgba(56, 189, 248, 0.65)',
              fontSize: '9px',
              letterSpacing: '0.5px',
            }}
            title="Automatically closes after 2 minutes of inactivity"
          >
            <Clock size={10} />
            <span>AUTO-CLOSE // {formatTime(secondsRemaining)}</span>
          </div>

          {/* Close Control */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: '#94a3b8',
              padding: '3px 7px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <X size={11} />
            <span>CLOSE</span>
          </button>
        </div>
      </div>

      {/* Planetary Telemetry Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>ORBIT PERIOD</span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{planet.orbitalPeriodDays.toFixed(1)} DAYS</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>AXIAL TILT</span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{planet.axialTilt}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>ROTATION</span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{planet.rotationPeriodHours.toFixed(1)} HRS</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>VISUAL RADIUS</span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{planet.radius} R⊕</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>DISTANCE SCALE</span>
          <span style={{ color: '#00e5ff', fontWeight: 700 }}>{planet.distanceScale} AU-x</span>
        </div>
      </div>
    </div>
  );
};

export default PlanetInfoPanel;
