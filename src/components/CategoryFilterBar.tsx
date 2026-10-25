import React from 'react';
import { useSolarStore } from '../store/useSolarStore';
import { SATELLITES } from './Satellite';
import { Orbit } from 'lucide-react';

export const FILTER_CATEGORIES = [
  { id: 'ALL', name: 'ALL FLEET', color: '#f8fafc' },
  { id: 'space_station', name: 'STATIONS', color: '#00e5ff' },
  { id: 'constellation', name: 'CONSTELLATIONS', color: '#38bdf8' },
  { id: 'navigation', name: 'NAVIGATION', color: '#22c55e' },
  { id: 'earth_obs', name: 'EARTH OBS', color: '#eab308' },
  { id: 'weather', name: 'WEATHER', color: '#f97316' },
  { id: 'communication', name: 'COMMS', color: '#38bdf8' },
  { id: 'science', name: 'SCIENCE', color: '#ec4899' },
  { id: 'defense_other', name: 'DEFENSE', color: '#ef4444' },
];

export function CategoryFilterBar({
  bottomOffset = '36px',
  extraAction
}: {
  bottomOffset?: string;
  extraAction?: React.ReactNode;
}) {
  const showSatelliteOrbits = useSolarStore((s) => s.showSatelliteOrbits);
  const toggleSatelliteOrbits = useSolarStore((s) => s.toggleSatelliteOrbits);
  const activeCategoryFilter = useSolarStore((s) => s.activeCategoryFilter);
  const setActiveCategoryFilter = useSolarStore((s) => s.setActiveCategoryFilter);
  const catalogCategories = useSolarStore((s) => s.catalogCategories);
  const catalogSatellites = useSolarStore((s) => s.catalogSatellites);

  const totalSatsCount = catalogSatellites.length > 0 ? catalogSatellites.length : 50;

  const monoTextStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", "JetBrains Mono", ui-monospace, monospace',
  };

  return (
    <nav
      aria-label="Aerospace Filter and Sensor Control Rail"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(2, 6, 23, 0.76)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
        clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
        padding: '5px 8px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(6, 182, 212, 0.08)',
        pointerEvents: 'auto',
        userSelect: 'none',
        maxWidth: '96vw',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        zIndex: 45,
        ...monoTextStyle,
      }}
    >
      {/* Global Sensor State: Orbit Paths Instrument Switch */}
      <button
        type="button"
        onClick={toggleSatelliteOrbits}
        title="Toggle 3D Orbital Trajectory Rendering On/Off"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: showSatelliteOrbits
            ? 'linear-gradient(180deg, rgba(6, 182, 212, 0.18) 0%, rgba(2, 6, 23, 0.5) 100%)'
            : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${showSatelliteOrbits ? 'rgba(6, 182, 212, 0.65)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderBottom: `2px solid ${showSatelliteOrbits ? '#06b6d4' : 'rgba(255, 255, 255, 0.2)'}`,
          clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
          padding: '5px 11px',
          color: showSatelliteOrbits ? '#22d3ee' : '#94a3b8',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: showSatelliteOrbits ? '0 0 12px rgba(6, 182, 212, 0.25)' : 'none',
          transition: 'all 0.15s ease',
          outline: 'none',
          ...monoTextStyle,
        }}
      >
        <Orbit size={12} strokeWidth={2.2} style={{ color: showSatelliteOrbits ? '#22d3ee' : '#64748b' }} />
        <span>ORBITS</span>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 800,
            padding: '1px 5px',
            background: showSatelliteOrbits ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.06)',
            color: showSatelliteOrbits ? '#67e8f9' : '#64748b',
            borderRadius: '2px',
          }}
        >
          {showSatelliteOrbits ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Hairline Separator */}
      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 4px' }} />

      {/* Category Sensor Filters with Angular Cut and Subdued Count Metadata */}
      {FILTER_CATEGORIES.map((cat) => {
        const isSelected = activeCategoryFilter === cat.id;
        const catStat = catalogCategories.find((c) => c.id === cat.id);
        const exactCount =
          cat.id === 'ALL'
            ? totalSatsCount
            : SATELLITES.filter((s) => s.categoryId === cat.id).length || catStat?.count || 0;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategoryFilter(cat.id)}
            title={`Filter fleet: ${cat.name} (${exactCount} objects)`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isSelected
                ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(2, 6, 23, 0.4) 100%)'
                : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.07)'}`,
              borderBottom: `2px solid ${isSelected ? cat.color : 'transparent'}`,
              clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)',
              padding: '5px 9px',
              color: isSelected ? '#f8fafc' : '#94a3b8',
              fontSize: '10px',
              fontWeight: isSelected ? 800 : 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: isSelected ? `0 0 10px ${cat.color}33` : 'none',
              transition: 'all 0.15s ease',
              outline: 'none',
              ...monoTextStyle,
            }}
          >
            {/* Small Micro Semantic Indicator Dot */}
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: cat.color,
                boxShadow: isSelected ? `0 0 6px ${cat.color}` : 'none',
                opacity: isSelected ? 1 : 0.65,
              }}
            />

            <span>{cat.name}</span>

            {/* Secondary Count Metadata */}
            <span
              style={{
                fontSize: '9px',
                color: isSelected ? '#cbd5e1' : '#64748b',
                fontWeight: 600,
                opacity: 0.8,
                marginLeft: '1px',
              }}
            >
              {exactCount}
            </span>
          </button>
        );
      })}

      {/* Extra Action (e.g. Refresh Demo Button) */}
      {extraAction && (
        <>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 4px' }} />
          {extraAction}
        </>
      )}
    </nav>
  );
}

export default CategoryFilterBar;
