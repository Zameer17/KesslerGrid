import React, { useState } from 'react';
import { Navigation, Orbit, Globe, Sun, Circle, ChevronDown, ChevronUp, RotateCcw, Check } from 'lucide-react';
import { useSolarStore } from '../store/useSolarStore';
import { SATELLITES } from './Satellite';

export interface CelestialBodyInfo {
  id: string;
  name: string;
  classification: string;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}

const CELESTIAL_BODIES: CelestialBodyInfo[] = [
  { id: 'sun', name: 'SUN', classification: 'SYSTEM STAR', color: '#f59e0b', icon: Sun },
  { id: 'mercury', name: 'MERCURY', classification: 'TERRESTRIAL', color: '#94a3b8', icon: Orbit },
  { id: 'venus', name: 'VENUS', classification: 'TERRESTRIAL', color: '#f59e0b', icon: Orbit },
  { id: 'earth', name: 'EARTH', classification: 'TERRESTRIAL (HUB)', color: '#38bdf8', icon: Globe },
  { id: 'moon', name: 'MOON', classification: 'NATURAL SATELLITE', color: '#e2e8f0', icon: Circle },
  { id: 'mars', name: 'MARS', classification: 'TERRESTRIAL', color: '#ef4444', icon: Orbit },
  { id: 'jupiter', name: 'JUPITER', classification: 'GAS GIANT', color: '#fb923c', icon: Orbit },
  { id: 'saturn', name: 'SATURN', classification: 'GAS GIANT (RINGS)', color: '#eab308', icon: Orbit },
  { id: 'uranus', name: 'URANUS', classification: 'ICE GIANT', color: '#06b6d4', icon: Orbit },
  { id: 'neptune', name: 'NEPTUNE', classification: 'ICE GIANT', color: '#3b82f6', icon: Orbit },
];

interface FastTravelDropdownProps {
  variant?: 'top-center' | 'top-right';
  style?: React.CSSProperties;
  onSelectCallback?: (id: string) => void;
}

export const FastTravelDropdown: React.FC<FastTravelDropdownProps> = ({
  variant = 'top-right',
  style,
  onSelectCallback,
}) => {
  const focusedBody = useSolarStore((state) => state.focusedBody);
  const setFocusedBody = useSolarStore((state) => state.setFocusedBody);
  const [isOpen, setIsOpen] = useState(false);

  const selectedBody = CELESTIAL_BODIES.find((b) => b.id === focusedBody);
  const activeSatellite = SATELLITES.find((s) => s.id === focusedBody);

  const handleSelect = (id: string) => {
    if (focusedBody === id) {
      // Re-trigger camera transition
      setFocusedBody('');
      setTimeout(() => setFocusedBody(id), 10);
    } else {
      setFocusedBody(id);
    }
    if (onSelectCallback) {
      onSelectCallback(id);
    }
    setIsOpen(false);
  };

  const isTopCenter = variant === 'top-center';

  const defaultPositionStyle: React.CSSProperties = isTopCenter
    ? {
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 48,
      }
    : {
        position: 'absolute',
        top: '24px',
        right: '36px',
        zIndex: 50,
      };

  const destinationLabel = selectedBody
    ? selectedBody.name
    : activeSatellite
    ? activeSatellite.name.toUpperCase()
    : 'SOLAR SYSTEM';

  return (
    <div
      style={{
        ...defaultPositionStyle,
        pointerEvents: 'auto',
        fontFamily: '"Space Mono", monospace, ui-monospace',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(6, 11, 25, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '8px',
          padding: isTopCenter ? '7px 16px' : '8px 14px',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.12)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = '#00e5ff';
          (e.currentTarget as HTMLElement).style.background = 'rgba(6, 11, 25, 0.98)';
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 229, 255, 0.25)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56, 189, 248, 0.35)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(6, 11, 25, 0.92)';
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.12)';
        }}
      >
        {isTopCenter ? (
          <>
            <Navigation size={13} color="#00e5ff" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '1px' }}>
                FAST TRAVEL
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00e5ff', letterSpacing: '0.8px' }}>
                DESTINATION: {destinationLabel}
              </span>
            </div>
            {isOpen ? <ChevronUp size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#94a3b8" />}
          </>
        ) : (
          <>
            <Navigation size={13} color="#00e5ff" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '1px', fontWeight: 700 }}>
                  FAST TRAVEL
                </span>
                <span style={{ fontSize: '8px', color: 'rgba(56, 189, 248, 0.7)', letterSpacing: '0.5px' }}>
                  // CELESTIAL BODIES
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00e5ff', letterSpacing: '0.8px' }}>
                DESTINATION: {destinationLabel}
              </span>
            </div>
            {isOpen ? <ChevronUp size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#94a3b8" />}
          </>
        )}
      </button>

      {/* Expanded Dropdown Options Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: isTopCenter ? '50%' : 'auto',
            right: isTopCenter ? 'auto' : 0,
            transform: isTopCenter ? 'translateX(-50%)' : 'none',
            width: '260px',
            background: 'rgba(6, 11, 25, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '10px',
            padding: '8px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85), 0 0 24px rgba(0, 229, 255, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            maxHeight: '380px',
            overflowY: 'auto',
            zIndex: 60,
          }}
        >
          {/* Header Tag */}
          <div
            style={{
              padding: '6px 8px',
              fontSize: '9px',
              fontWeight: 700,
              color: 'rgba(56, 189, 248, 0.7)',
              letterSpacing: '1.5px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>ORBITAL DESTINATIONS</span>
            <span>SYSTEM HUD</span>
          </div>

          {/* List of Celestial Bodies */}
          {CELESTIAL_BODIES.map((body) => {
            const isSelected = focusedBody === body.id;
            const BodyIcon = body.icon;
            return (
              <button
                key={body.id}
                onClick={() => handleSelect(body.id)}
                style={{
                  background: isSelected ? 'rgba(0, 229, 255, 0.14)' : 'transparent',
                  border: isSelected ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: isSelected ? '#00e5ff' : '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: '"Space Mono", monospace, ui-monospace',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.06)';
                    (e.currentTarget as HTMLElement).style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#e2e8f0';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BodyIcon size={13} color={isSelected ? '#00e5ff' : body.color} />
                  <div>
                    <div style={{ letterSpacing: '0.8px', fontSize: '11px' }}>{body.name}</div>
                    <div style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>
                      {body.classification}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={12} color="#00e5ff" />}
              </button>
            );
          })}

          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '6px 0' }} />

          {/* Reset View Action */}
          <button
            onClick={() => handleSelect('sun')}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '7px 10px',
              color: '#ffffff',
              fontSize: '10.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              fontFamily: '"Space Mono", monospace, ui-monospace',
              letterSpacing: '0.8px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0, 229, 255, 0.2)';
              (e.currentTarget as HTMLElement).style.borderColor = '#00e5ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
          >
            <RotateCcw size={12} color="#00e5ff" />
            <span>RESET VIEW (SOLAR SYSTEM)</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default FastTravelDropdown;
