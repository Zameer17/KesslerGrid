import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useSolarStore } from '../store/useSolarStore';
import { web3Service } from '../services/web3';
import { api, BackendSatellite } from '../services/api';
import { broadcastSatelliteRefresh, broadcastSceneReset, broadcastTxStarted, broadcastTxFinished, kesslerSyncChannel } from '../services/syncChannel';
import { NORAD_SATELLITES, NoradSatellite } from '../data/noradSatellites';
import { SatelliteModelMesh, useSatelliteTextures } from './Satellite';
import { MetaMaskFoxIcon, MetaMaskWatermark } from './MetaMaskFoxIcon';
import {
  Radio,
  AlertTriangle,
  CheckCircle2,
  Skull,
  Coins,
  Activity,
  X,
  ShieldAlert,
  Crosshair,
  Database,
  Cpu,
  Orbit,
  Satellite,
  Eye,
  CloudSun,
  Telescope,
  Shield,
  Compass,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

export interface SatelliteClassification {
  label: string;
  code: string;
  glyph: string;
  icon: typeof Orbit;
  color: string;
}

export function getSatelliteClassification(sat: NoradSatellite | { category?: string; categoryId?: string; modelType?: string; name?: string }): SatelliteClassification {
  const cat = (sat.category || '').toLowerCase();
  const catId = (sat.categoryId || '').toLowerCase();
  const name = (sat.name || '').toUpperCase();
  const modelType = (sat.modelType || '').toLowerCase();

  // 1. Space Station
  if (catId === 'space_station' || cat.includes('station') || modelType === 'station' || name.includes('ISS') || name.includes('TIANGONG')) {
    return {
      label: 'SPACE STATION',
      code: 'STN',
      glyph: '⛯',
      icon: Orbit,
      color: '#00e5ff',
    };
  }

  // 2. Earth Observation / Remote Sensing
  if (catId === 'earth_obs' || cat.includes('observation') || modelType === 'radar' || modelType === 'optical_earth_obs' || name.includes('SENTINEL') || name.includes('LANDSAT') || name.includes('TERRA')) {
    return {
      label: 'EARTH OBSERVATION',
      code: 'OBS',
      glyph: '◬',
      icon: Eye,
      color: '#eab308',
    };
  }

  // 3. Navigation / GNSS
  if (catId === 'navigation' || cat.includes('navigation') || modelType === 'navigation' || name.includes('GPS') || name.includes('GALILEO') || name.includes('GLONASS')) {
    return {
      label: 'NAVIGATION',
      code: 'NAV',
      glyph: '◇',
      icon: Compass,
      color: '#22c55e',
    };
  }

  // 4. Weather & Climate
  if (catId === 'weather' || cat.includes('weather') || cat.includes('climate') || modelType === 'meteorological' || name.includes('NOAA') || name.includes('GOES') || name.includes('METEOSAT')) {
    return {
      label: 'WEATHER / CLIMATE',
      code: 'MET',
      glyph: '☼',
      icon: CloudSun,
      color: '#f97316',
    };
  }

  // 5. Science & Astrophysics
  if (catId === 'science' || cat.includes('science') || modelType === 'telescope' || modelType === 'gamma_telescope' || name.includes('HST') || name.includes('HUBBLE') || name.includes('WEBB') || name.includes('CHANDRA')) {
    return {
      label: 'SPACE SCIENCE',
      code: 'SCI',
      glyph: '✦',
      icon: Telescope,
      color: '#ec4899',
    };
  }

  // 6. Defense / Inspector / Reconnaissance
  if (catId === 'defense_other' || cat.includes('defense') || cat.includes('inspector') || modelType === 'reconnaissance' || modelType === 'early_warning' || modelType === 'hitech_sensor_boom' || name.includes('USA') || name.includes('NRO') || name.includes('DEFENSE')) {
    return {
      label: 'DEFENSE & INSPECTOR',
      code: 'DEF',
      glyph: '▲',
      icon: Shield,
      color: '#ef4444',
    };
  }

  // 7. Mega-Constellation & Communication
  if (catId === 'communication' || catId === 'constellation' || cat.includes('constellation') || cat.includes('communication') || modelType === 'communication' || modelType === 'telecom_parabolic_dish' || modelType === 'telecom_relay' || name.includes('STARLINK') || name.includes('ONEWEB') || name.includes('IRIDIUM')) {
    return {
      label: 'COMMUNICATION',
      code: 'COM',
      glyph: '📡',
      icon: Radio,
      color: '#38bdf8',
    };
  }

  // Default: General Orbital Asset
  return {
    label: 'ORBITAL ASSET',
    code: 'SAT',
    glyph: '⬡',
    icon: Satellite,
    color: '#94a3b8',
  };
}

// Custom Technical Aerospace Satellite Dropdown Component
// Renders dark obsidian styling, custom aerospace scrollbar, technical classification vector icons, and zero white UI
interface AerospaceSatelliteDropdownProps {
  satellites: any[];
  selectedValue: string;
  onSelect: (value: string) => void;
  getSatelliteStatus: (sat: any) => 'REGISTERED' | 'UNREGISTERED' | 'DESTROYED';
  accentTheme?: 'cyan' | 'magenta';
  disabled?: boolean;
}

function AerospaceSatelliteDropdown({
  satellites,
  selectedValue,
  onSelect,
  getSatelliteStatus,
  accentTheme = 'cyan',
  disabled = false,
}: AerospaceSatelliteDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMagenta = accentTheme === 'magenta';
  const primaryColor = isMagenta ? '#ec4899' : '#06b6d4';
  const textColor = isMagenta ? '#f9a8d4' : '#67e8f9';
  const activeBg = isMagenta ? 'rgba(236, 72, 153, 0.16)' : 'rgba(6, 182, 212, 0.16)';
  const hoverBg = isMagenta ? 'rgba(236, 72, 153, 0.09)' : 'rgba(6, 182, 212, 0.09)';
  const borderColor = isMagenta ? 'rgba(236, 72, 153, 0.4)' : 'rgba(6, 182, 212, 0.4)';
  const openBorderColor = isMagenta ? '#ec4899' : '#06b6d4';

  const selectedSat = useMemo(() => {
    if (!selectedValue) return satellites[0] || null;
    const found = satellites.find(
      (s) =>
        (s.noradId && String(s.noradId) === String(selectedValue)) ||
        s.id === selectedValue ||
        s.name === selectedValue
    );
    if (found) return found;

    return {
      id: selectedValue,
      name: selectedValue,
      noradId: parseInt(selectedValue, 10) || 0,
      category: 'Active Asset',
      categoryId: 'active',
      modelType: 'cubesat',
    };
  }, [satellites, selectedValue]);

  const selectedStatus = selectedSat ? getSatelliteStatus(selectedSat) : 'UNREGISTERED';
  const selectedClass = selectedSat ? getSatelliteClassification(selectedSat) : null;
  const SelectedIcon = selectedClass?.icon || Satellite;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {/* Closed Button Header Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: '52px',
          background: 'rgba(0, 0, 0, 0.55)',
          border: 'none',
          borderBottom: `2px solid ${isOpen ? openBorderColor : borderColor}`,
          borderRadius: 0,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.18s ease',
          boxShadow: isOpen ? `0 6px 20px -4px ${primaryColor}40` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {/* Classification Vector Icon */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '2px',
              background: `${selectedClass?.color || '#94a3b8'}18`,
              border: `1px solid ${selectedClass?.color || '#94a3b8'}45`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: selectedClass?.color || '#94a3b8',
              flexShrink: 0,
            }}
          >
            <SelectedIcon size={14} strokeWidth={2.2} />
          </div>

          {/* Satellite Status Badge */}
          <span
            style={{
              fontSize: '10px',
              fontFamily: '"Space Mono", monospace',
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '2px 6px',
              background:
                selectedStatus === 'DESTROYED'
                  ? 'rgba(244, 63, 94, 0.18)'
                  : selectedStatus === 'REGISTERED'
                  ? 'rgba(52, 211, 153, 0.18)'
                  : 'rgba(100, 116, 139, 0.2)',
              color:
                selectedStatus === 'DESTROYED'
                  ? '#fb7185'
                  : selectedStatus === 'REGISTERED'
                  ? '#34d399'
                  : '#cbd5e1',
              border: `1px solid ${
                selectedStatus === 'DESTROYED'
                  ? 'rgba(244, 63, 94, 0.4)'
                  : selectedStatus === 'REGISTERED'
                  ? 'rgba(52, 211, 153, 0.4)'
                  : 'rgba(100, 116, 139, 0.3)'
              }`,
              flexShrink: 0,
            }}
          >
            {selectedStatus === 'DESTROYED'
              ? 'DESTROYED'
              : selectedStatus === 'REGISTERED'
              ? 'REGISTERED'
              : 'UNREGISTERED'}
          </span>

          {/* Satellite Name & NORAD */}
          <span
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '14px',
              fontWeight: 800,
              color: textColor,
              letterSpacing: '0.04em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedSat?.name} (#{selectedSat?.noradId})
          </span>

          {/* Classification Label */}
          {selectedClass && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: '"Space Mono", monospace',
                fontWeight: 700,
                color: selectedClass.color,
                letterSpacing: '0.06em',
                padding: '2px 6px',
                background: `${selectedClass.color}12`,
                border: `1px solid ${selectedClass.color}30`,
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              {selectedClass.label}
            </span>
          )}
        </div>

        {/* Chevron Indicator */}
        <ChevronDown
          size={16}
          style={{
            color: primaryColor,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dark Obsidian Angular Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            maxHeight: '320px',
            background: 'rgba(2, 6, 23, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${borderColor}`,
            boxShadow: `0 14px 40px rgba(0, 0, 0, 0.85), 0 0 20px ${primaryColor}20`,
            zIndex: 9999,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(71, 85, 105, 0.75) rgba(2, 6, 23, 0.95)',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
          }}
        >
          {satellites.map((sat) => {
            const status = getSatelliteStatus(sat);
            const satClass = getSatelliteClassification(sat);
            const IconComp = satClass.icon;
            const isSelected =
              String(sat.noradId) === String(selectedValue) ||
              sat.id === selectedValue ||
              sat.name === selectedValue;
            const isDestroyed = status === 'DESTROYED';

            return (
              <div
                key={sat.noradId}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  // Pass noradId if selectedValue matches noradId format, or sat.name if matched by name
                  const passValue = typeof sat.noradId === 'number' && !isNaN(Number(selectedValue))
                    ? String(sat.noradId)
                    : sat.name;
                  onSelect(passValue);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isSelected ? activeBg : 'transparent',
                  borderLeft: isSelected ? `3px solid ${primaryColor}` : '3px solid transparent',
                  borderBottom: '1px solid rgba(100, 116, 139, 0.12)',
                  transition: 'background 0.14s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Classification Vector Icon */}
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '2px',
                    background: `${satClass.color}15`,
                    border: `1px solid ${satClass.color}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: satClass.color,
                    flexShrink: 0,
                  }}
                >
                  <IconComp size={13} strokeWidth={2.2} />
                </div>

                {/* Status Badge */}
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: '"Space Mono", monospace',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    padding: '2px 6px',
                    background: isDestroyed
                      ? 'rgba(244, 63, 94, 0.18)'
                      : status === 'REGISTERED'
                      ? 'rgba(52, 211, 153, 0.18)'
                      : 'rgba(100, 116, 139, 0.18)',
                    color: isDestroyed
                      ? '#fb7185'
                      : status === 'REGISTERED'
                      ? '#34d399'
                      : '#cbd5e1',
                    border: `1px solid ${
                      isDestroyed
                        ? 'rgba(244, 63, 94, 0.35)'
                        : status === 'REGISTERED'
                        ? 'rgba(52, 211, 153, 0.35)'
                        : 'rgba(100, 116, 139, 0.25)'
                    }`,
                    flexShrink: 0,
                  }}
                >
                  {status === 'DESTROYED'
                    ? 'DESTROYED'
                    : status === 'REGISTERED'
                    ? 'REGISTERED'
                    : 'UNREGISTERED'}
                </span>

                {/* Satellite Name & NORAD */}
                <span
                  style={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '13px',
                    fontWeight: isSelected ? 800 : 600,
                    color: isDestroyed ? '#fb7185' : isSelected ? textColor : '#cbd5e1',
                    letterSpacing: '0.04em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {sat.name} (#{sat.noradId})
                </span>

                {/* Classification Category */}
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: '"Space Mono", monospace',
                    fontWeight: 700,
                    color: satClass.color,
                    letterSpacing: '0.08em',
                    padding: '2px 6px',
                    background: `${satClass.color}10`,
                    border: `1px solid ${satClass.color}25`,
                    flexShrink: 0,
                  }}
                >
                  {satClass.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Actual 3D Satellite Model Renderer (reusing the exact 3D models and materials from the solar-system scene)
function SatelliteInspectionModel({ sat }: { sat: NoradSatellite }) {
  const textures = useSatelliteTextures();
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Subtle, steady aerospace inspection rotation (slow and engineering-focused)
      groupRef.current.rotation.y += delta * 0.32;
    }
  });

  // Calculate tailored framing scale based on satellite archetype
  // Stations (ISS/Tiangong) have wide solar trusses (~2.4 units), telescopes (~1.8 units), cubesats/constellations (~1.2 units)
  const baseScale =
    sat.modelType === 'station' || sat.name.includes('ISS') || sat.name.includes('TIANGONG')
      ? 0.72
      : sat.modelType === 'telescope' || sat.name.includes('HUBBLE')
      ? 0.88
      : sat.modelType === 'tether'
      ? 0.82
      : 1.05;

  return (
    <group ref={groupRef} scale={[baseScale, baseScale, baseScale]} rotation={[0.22, 0.45, 0]}>
      <SatelliteModelMesh modelType={sat.modelType} textures={textures} />
    </group>
  );
}

// 3D Optical Targeting Inspection Viewport
function Satellite3DInspectionViewport({ sat, isDestroyed }: { sat: NoradSatellite; isDestroyed?: boolean }) {
  const hasModel = !!sat.modelType;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '260px',
        background: isDestroyed
          ? 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.12) 0%, rgba(2, 6, 23, 0.65) 75%)'
          : 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, rgba(2, 6, 23, 0.58) 75%)',
        border: `1px solid ${isDestroyed ? 'rgba(244, 63, 94, 0.4)' : 'rgba(6, 182, 212, 0.3)'}`,
        boxShadow: `inset 0 0 30px ${isDestroyed ? 'rgba(244, 63, 94, 0.1)' : 'rgba(6, 182, 212, 0.06)'}`,
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px 18px',
      }}
    >
      {/* Target Status Header Overlay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crosshair size={14} style={{ color: isDestroyed ? '#f43f5e' : '#22d3ee' }} />
          <span style={{ fontSize: '11px', fontFamily: '"Space Mono", monospace', fontWeight: 800, color: isDestroyed ? '#fb7185' : '#38bdf8', letterSpacing: '0.12em' }}>
            {isDestroyed ? 'ORBITAL TARGET // SIGNAL LOST' : 'ORBITAL TARGET // OPTICAL LOCK'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDestroyed ? '#f43f5e' : '#22d3ee', boxShadow: isDestroyed ? '0 0 10px #f43f5e' : '0 0 10px #22d3ee' }} />
          <span style={{ fontSize: '11px', fontFamily: '"Space Mono", monospace', fontWeight: 800, color: isDestroyed ? '#fb7185' : '#22d3ee', letterSpacing: '0.1em' }}>
            {isDestroyed ? 'DESTROYED' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Optical Reticle Guides & Range Ticks */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '1px dashed rgba(6, 182, 212, 0.16)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '1px solid rgba(6, 182, 212, 0.12)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '260px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.25), transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            height: '180px',
            width: '1px',
            background: 'linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.25), transparent)',
          }}
        />
      </div>

      {/* Actual 3D Satellite Model Canvas */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
        {hasModel ? (
          <motion.div
            key={sat.noradId || sat.name}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{ width: '100%', height: '100%' }}
          >
            <Canvas
              camera={{ position: [0, 0.22, 2.3], fov: 42 }}
              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
              gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            >
              <ambientLight intensity={1.4} />
              <directionalLight position={[5, 6, 4]} intensity={2.8} />
              <directionalLight position={[-4, -2, -3]} intensity={1.6} color="#38bdf8" />
              <directionalLight position={[0, -4, 2]} intensity={0.8} color="#f59e0b" />
              <SatelliteInspectionModel sat={sat} />
            </Canvas>
          </motion.div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: '"Space Mono", monospace',
              color: '#64748b',
              fontSize: '11px',
              letterSpacing: '0.1em',
            }}
          >
            <Crosshair size={24} style={{ color: '#475569' }} />
            <span>VISUAL ASSET NOT AVAILABLE</span>
            <span style={{ fontSize: '9px', color: '#334155' }}>TELEMETRY TRACK ONLY</span>
          </div>
        )}
      </div>

      {/* Target Acquisition Corner Brackets */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderTop: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4', zIndex: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderTop: '2px solid #06b6d4', borderRight: '2px solid #06b6d4', zIndex: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 12, height: 12, borderBottom: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4', zIndex: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderBottom: '2px solid #06b6d4', borderRight: '2px solid #06b6d4', zIndex: 10, pointerEvents: 'none' }} />

      {/* Viewport Bottom Telemetry Track */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '8px',
          borderTop: '1px solid rgba(6, 182, 212, 0.18)',
          fontFamily: '"Space Mono", monospace',
          fontSize: '11px',
          color: '#38bdf8',
          zIndex: 10,
        }}
      >
        <span>TRACK: LOCKED</span>
        <span>CLASS: {sat.category?.toUpperCase() || 'ORBITAL ASSET'}</span>
        <span>NORAD: #{sat.noradId}</span>
      </div>
    </div>
  );
}

export function CyberDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeSection, setActiveSection] = useState<'staking' | 'register'>('staking');

  // Zustand Web3 & Backend State (Strict preservation)
  const walletAddress = useSolarStore((s) => s.walletAddress);
  const walletBalanceEth = useSolarStore((s) => s.walletBalanceEth);
  const isWeb3Connected = useSolarStore((s) => s.isWeb3Connected);
  const setWalletState = useSolarStore((s) => s.setWalletState);
  const backendSatellites = useSolarStore((s) => s.backendSatellites);
  const destroyedDemoIds = useSolarStore((s) => s.destroyedDemoIds);
  const addAuditLog = useSolarStore((s) => s.addAuditLog);

  // Staking Form State
  const [selectedSatId, setSelectedSatId] = useState(NORAD_SATELLITES[0].noradId.toString());
  const [stakeAmountEth, setStakeAmountEth] = useState('2.5');
  const isSubmitting = useSolarStore((s) => s.isGlobalTxPending);
  const isGlobalTxPending = isSubmitting;
  const setIsGlobalTxPending = useSolarStore((s) => s.setIsGlobalTxPending);
  const setIsSubmitting = setIsGlobalTxPending;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hudNotice, setHudNotice] = useState<{ title: string; message: string; type: 'INFO' | 'SUCCESS' | 'WARNING' } | null>(null);

  // Register Form State
  const [regSatId, setRegSatId] = useState('SAT-ORBITAL-X');
  const [regNoradId, setRegNoradId] = useState('60124');
  const [regName, setRegName] = useState('SENTINEL-X RECON');
  const [regStakeEth, setRegStakeEth] = useState('2.5');
  const [regPenaltyEth, setRegPenaltyEth] = useState('5.0');

  // Deduplicated Fleet: Combines static NORAD catalog with dynamic backend registered fleet
  const allAvailableSatellites = useMemo(() => {
    const map = new Map<string, any>();
    NORAD_SATELLITES.forEach((sat) => {
      map.set(sat.name, { ...sat });
    });
    (backendSatellites || []).forEach((b) => {
      const key = b.satellite_name || b.sat_id;
      const bNorad = b.norad_cat_id ? Number(b.norad_cat_id) : 0;
      const existing = map.get(key) || (bNorad > 0 ? Array.from(map.values()).find((s) => Number(s.noradId) === bNorad) : null);

      const isReg = Boolean(
        b.is_registered ||
        b.isRegistered ||
        b.on_chain_status === 'REGISTERED' ||
        b.operational_status === 'REGISTERED' ||
        Number(b.staked_amount_eth) > 0 ||
        Number(b.staked_eth) > 0 ||
        (b.operator_address && b.operator_address !== 'UNREGISTERED' && String(b.operator_address).toLowerCase().startsWith('0x'))
      );

      const mergedPayload = {
        id: b.sat_id,
        name: b.satellite_name || b.sat_id,
        noradId: b.norad_cat_id || 0,
        category: 'Active Fleet',
        categoryId: 'active_fleet',
        modelType: 'cubesat',
        ...b,
        isRegistered: isReg,
        is_registered: isReg,
        on_chain_status: isReg ? 'REGISTERED' : 'UNREGISTERED',
        staked_amount_eth: b.staked_amount_eth ?? (b as any).staked_eth ?? 0,
        staked_eth: b.staked_amount_eth ?? (b as any).staked_eth ?? 0,
      };

      if (existing) {
        map.set(existing.name || key, {
          ...existing,
          ...mergedPayload,
          id: existing.id || b.sat_id,
          name: existing.name || b.satellite_name || b.sat_id,
          noradId: existing.noradId || b.norad_cat_id || 0,
        });
      } else {
        map.set(key, mergedPayload);
      }
    });
    return Array.from(map.values());
  }, [backendSatellites]);

  const uniqueNoradSatellites = allAvailableSatellites;

  // Centralized status resolver from useSolarStore
  const getSatelliteStatus = useSolarStore((s) => s.getSatelliteStatus);

  // Synchronize drawer open state with useSolarStore to suppress 3D annotations
  useEffect(() => {
    useSolarStore.getState().setIsCyberDrawerOpen(isOpen);
  }, [isOpen]);

  // Dynamic calculation of fleet metrics using getSatelliteStatus for exact match with dropdown
  const fleetCounts = useMemo(() => {
    let registered = 0;
    let destroyed = 0;
    let unregistered = 0;

    uniqueNoradSatellites.forEach((sat) => {
      const status = getSatelliteStatus(sat);
      if (status === 'DESTROYED') {
        destroyed++;
      } else if (status === 'REGISTERED') {
        registered++;
      } else {
        unregistered++;
      }
    });

    return {
      catalog: uniqueNoradSatellites.length,
      registered,
      destroyed,
      unregistered,
    };
  }, [uniqueNoradSatellites, getSatelliteStatus, backendSatellites, destroyedDemoIds]);

  const currentStakingSat = useMemo(() => {
    const found = allAvailableSatellites.find(
      (s) => (s.noradId && String(s.noradId) === String(selectedSatId)) || s.id === selectedSatId || s.name === selectedSatId
    );
    if (found) return found;
    if (selectedSatId) {
      return {
        id: selectedSatId,
        name: selectedSatId,
        noradId: parseInt(selectedSatId, 10) || 0,
        category: 'Active Asset',
        categoryId: 'active',
        modelType: 'cubesat',
      };
    }
    return allAvailableSatellites[0] || null;
  }, [allAvailableSatellites, selectedSatId]);

  const isCurrentStakingDestroyed = currentStakingSat
    ? getSatelliteStatus(currentStakingSat) === 'DESTROYED'
    : false;

  const currentStakingStatus = currentStakingSat
    ? getSatelliteStatus(currentStakingSat)
    : 'UNREGISTERED';

  const isStakeDisabled = isSubmitting || currentStakingStatus !== 'REGISTERED';

  const currentRegSat = useMemo(() => {
    const targetName = (regName || regSatId || '').trim();
    const targetNorad = (regNoradId || '').trim();

    // 1. Check all available satellites (catalog + backend)
    const found = allAvailableSatellites.find(
      (s) =>
        (targetName && s.name && s.name.toLowerCase() === targetName.toLowerCase()) ||
        (targetName && s.id && s.id.toLowerCase() === targetName.toLowerCase()) ||
        (targetNorad && targetNorad !== '0' && String(s.noradId) === targetNorad)
    );
    if (found) return found;

    // 2. Synthesize satellite object from inputs
    if (targetName) {
      return {
        id: (regSatId || regName).trim(),
        name: targetName,
        noradId: parseInt(targetNorad, 10) || 0,
        category: 'Custom Sat',
        categoryId: 'custom',
        modelType: 'cubesat',
      };
    }
    return allAvailableSatellites[0] || null;
  }, [regName, regSatId, regNoradId, allAvailableSatellites]);

  const isCurrentRegDestroyed = currentRegSat
    ? getSatelliteStatus(currentRegSat) === 'DESTROYED'
    : false;

  const isCurrentRegRegistered = currentRegSat
    ? getSatelliteStatus(currentRegSat) === 'REGISTERED'
    : false;

  // Active target satellite for the Left Orbital Target Module
  // Instantly updates when the user switches satellites in Staking or presets in Registration
  const activeDisplaySat = useMemo(() => {
    if (activeSection === 'register') {
      return currentRegSat || currentStakingSat || allAvailableSatellites[0];
    }
    return currentStakingSat || allAvailableSatellites[0];
  }, [activeSection, currentRegSat, currentStakingSat, allAvailableSatellites]);

  // Selected asset database record for telemetry inspection
  const selectedBackendRecord = useMemo(() => {
    if (!activeDisplaySat) return null;
    const sName = (activeDisplaySat.name || (activeDisplaySat as any).satellite_name || '').trim();
    const sNorad = activeDisplaySat.noradId !== undefined && activeDisplaySat.noradId !== null 
      ? String(activeDisplaySat.noradId).trim() 
      : (activeDisplaySat as any).norad_cat_id !== undefined && (activeDisplaySat as any).norad_cat_id !== null
      ? String((activeDisplaySat as any).norad_cat_id).trim()
      : '';
    const sId = (activeDisplaySat.id || (activeDisplaySat as any).sat_id || sName).trim();
    const hasValidNorad = sNorad !== '' && sNorad !== '0' && !isNaN(Number(sNorad));

    return backendSatellites.find((b) => {
      if (hasValidNorad && b.norad_cat_id && String(b.norad_cat_id) === sNorad) return true;
      if (sName && b.sat_id && b.sat_id.trim().toLowerCase() === sName.toLowerCase()) return true;
      if (sName && b.satellite_name && b.satellite_name.trim().toLowerCase() === sName.toLowerCase()) return true;
      if (sId && b.sat_id && b.sat_id.trim().toLowerCase() === sId.toLowerCase()) return true;
      return false;
    }) || null;
  }, [backendSatellites, activeDisplaySat]);

  // Robust evaluation of registration state from store/backend object (camelCase & snake_case)
  const isActuallyRegistered = Boolean(
    activeDisplaySat?.isRegistered ||
    (activeDisplaySat as any)?.is_registered ||
    Number((activeDisplaySat as any)?.staked_eth) > 0 ||
    Number((activeDisplaySat as any)?.stakedEth) > 0 ||
    Number((activeDisplaySat as any)?.staked_amount_eth) > 0 ||
    (activeDisplaySat as any)?.on_chain_status === 'REGISTERED' ||
    (activeDisplaySat as any)?.onChainStatus === 'REGISTERED' ||
    (activeDisplaySat as any)?.operational_status === 'REGISTERED' ||
    selectedBackendRecord?.is_registered ||
    (selectedBackendRecord as any)?.isRegistered ||
    (selectedBackendRecord as any)?.on_chain_status === 'REGISTERED' ||
    (selectedBackendRecord as any)?.onChainStatus === 'REGISTERED' ||
    selectedBackendRecord?.operational_status === 'REGISTERED' ||
    Number(selectedBackendRecord?.staked_amount_eth) > 0 ||
    Number((selectedBackendRecord as any)?.staked_eth) > 0 ||
    (selectedBackendRecord?.operator_address &&
      selectedBackendRecord.operator_address !== 'UNREGISTERED' &&
      selectedBackendRecord.operator_address.toLowerCase().startsWith('0x')) ||
    (activeDisplaySat ? getSatelliteStatus(activeDisplaySat) === 'REGISTERED' : false)
  );

  const activeDisplayStatus = useMemo(() => {
    if (!activeDisplaySat) return 'UNREGISTERED';
    const directStatus = getSatelliteStatus(activeDisplaySat);
    if (directStatus === 'DESTROYED') return 'DESTROYED';
    if (isActuallyRegistered) return 'REGISTERED';
    return directStatus;
  }, [activeDisplaySat, getSatelliteStatus, isActuallyRegistered, backendSatellites]);

  const activeClassification = useMemo(() => {
    return activeDisplaySat ? getSatelliteClassification(activeDisplaySat) : null;
  }, [activeDisplaySat]);

  // Handlers
  const handleConnectWallet = async () => {
    try {
      const res = await web3Service.connectWallet();
      if (res) {
        setWalletState(res);
        setStatusMessage(`Connected MetaMask: ${res.address.slice(0, 6)}...${res.address.slice(-4)}`);
      }
    } catch (err: any) {
      setStatusMessage(`MetaMask Error: ${err.message}`);
    }
  };

  const handleClaimFaucet = async () => {
    if (!walletAddress) return;
    setIsGlobalTxPending(true);
    broadcastTxStarted();
    try {
      const txHash = await web3Service.fundWalletWithTestEth(walletAddress, '100.0');
      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);
      setStatusMessage(`Received 100 Test ETH! Tx: ${txHash.slice(0, 14)}...`);
    } catch (err: any) {
      setStatusMessage(`Faucet error: ${err.message}`);
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleExecuteStake = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    console.log("🚨 [BUTTON CLICKED] Register/Stake button triggered! Handler: handleExecuteStake", {
      selectedSatId,
      stakeAmountEth,
      isSubmitting,
      isGlobalTxPending,
      currentStakingStatus,
      isStakeDisabled,
    });
    console.log("🟣 [STAKE: START] Selected dropdown ID: ", selectedSatId, { stakeAmountEth });

    if (isCurrentStakingDestroyed) {
      console.warn("🟣 [STAKE: BLOCKED] Staking disabled for destroyed assets.");
      setStatusMessage('ASSET OFFLINE: Staking disabled for destroyed assets.');
      return;
    }

    const selectedSat = currentStakingSat || allAvailableSatellites.find(
      (s) => (s.noradId && String(s.noradId) === String(selectedSatId)) || s.id === selectedSatId || s.name === selectedSatId
    ) || { noradId: selectedSatId, norad_cat_id: selectedSatId, id: selectedSatId, name: selectedSatId };

    // Strictly enforce NORAD ID as the on-chain mapping key
    const canonicalId = String(selectedSat.noradId || selectedSat.norad_cat_id || selectedSat.id).trim();
    const displaySatName = selectedSat.name || selectedSat.id || canonicalId;

    setIsGlobalTxPending(true);
    broadcastTxStarted();
    try {
      if (!isWeb3Connected) await web3Service.connectWallet();

      console.log("🟣 [STAKE: ID RESOLVED] Canonical ID evaluated as: ", canonicalId, {
        selectedSatId,
        selectedSat,
      });

      // Hard pre-transaction guard clause
      const currentStatus = useSolarStore.getState().getSatelliteStatus(selectedSat);
      if (currentStatus !== 'REGISTERED') {
        throw new Error("UI Validation Failed: Satellite is not registered in the database. Cannot deploy collateral.");
      }

      console.log("🟣 [STAKE: WEB3] Sending Stake to Smart Contract...", { canonicalId, stakeAmountEth });
      const txHash = await web3Service.stakeOnChain(canonicalId, parseFloat(stakeAmountEth));
      console.log("🟣 [STAKE: WEB3 SUCCESS] Tx Hash: ", txHash);
      console.log("🚀 [PIPELINE STEP 1: TX SUCCESS]", {
        action: 'STAKE',
        txHash,
        canonicalId,
        displaySatName,
        amount: stakeAmountEth
      });

      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);

      // Sync additional stake to backend SQLite database
      try {
        const noradNum = parseInt(canonicalId, 10) || selectedSat.noradId || selectedSat.norad_cat_id || 0;
        const operator = walletAddress || updatedWallet?.address || 'UNREGISTERED';
        await api.registerSatellite({
          satId: canonicalId,
          noradId: noradNum,
          satelliteName: displaySatName,
          operatorAddress: operator,
          stakedEth: parseFloat(stakeAmountEth),
          liabilityPenaltyEth: parseFloat(stakeAmountEth) * 2.0,
        });
      } catch (syncErr: any) {
        console.warn('Backend stake sync note:', syncErr.message);
      }

      // Update stake in store immediately
      const addedEth = parseFloat(stakeAmountEth) || 0;
      const currentFleet = useSolarStore.getState().backendSatellites;
      const targetIdentifier = canonicalId.toLowerCase();
      const updatedFleet = currentFleet.map((s) => {
        if (
          s.sat_id.toLowerCase() === targetIdentifier ||
          s.satellite_name.toLowerCase() === targetIdentifier ||
          (s.norad_cat_id && String(s.norad_cat_id) === targetIdentifier) ||
          (selectedSat.name && s.satellite_name.toLowerCase() === selectedSat.name.toLowerCase())
        ) {
          return {
            ...s,
            staked_amount_eth: (Number(s.staked_amount_eth) || 0) + addedEth,
          };
        }
        return s;
      });
      useSolarStore.getState().setBackendSatellites(updatedFleet);

      // Re-fetch authoritative fresh data
      api.fetchSatellites().then((fresh) => {
        if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
      });

      broadcastSatelliteRefresh();
      addAuditLog(`STAKE UPDATE: Added ${stakeAmountEth} ETH collateral to ${displaySatName} (NORAD #${canonicalId}).`);
      const txPayload = {
        timestamp: new Date().toISOString(),
        actionType: 'STAKE DEPLOYED',
        satelliteName: displaySatName,
        noradId: canonicalId,
        valueEth: `${parseFloat(stakeAmountEth).toFixed(2)} ETH`,
        txHash: txHash,
      };
      console.log("📦 [PIPELINE STEP 2: DISPATCHING TO STORE]", txPayload);
      useSolarStore.getState().addWeb3Transaction(txPayload);
      setStatusMessage(`Stake confirmed for ${displaySatName}! Tx: ${txHash.slice(0, 14)}...`);
    } catch (err: any) {
      console.error("❌ [STAKE: ERROR] Smart Contract rejected the stake: ", err.message, err);
      // Check if user rejected the transaction in MetaMask
      if (
        err?.code === 4001 ||
        err?.code === 'ACTION_REJECTED' ||
        err?.message?.toLowerCase().includes("user rejected") ||
        err?.info?.error?.code === 4001
      ) {
        useSolarStore.getState().addWeb3Transaction({
          type: 'REJECT',
          satName: displaySatName,
          noradId: canonicalId,
          amount: 0,
          txHash: 'USER_ABORTED',
          timestamp: Date.now(),
          actionType: 'TRANSACTION REJECTED',
          satelliteName: displaySatName,
          valueEth: 'ABORTED',
        });
        setStatusMessage(`⚠️ Transaction cancelled by user in MetaMask.`);
      } else {
        setStatusMessage(`Staking error: ${err.message}`);
      }
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  // Cross-tab and inter-component instantaneous synchronization listener
  useEffect(() => {
    const handleBroadcast = async (event?: any) => {
      if (!event || !event.data || event.data?.type === 'REFRESH_SATELLITES') {
        const fresh = await api.fetchSatellites();
        if (fresh?.length) {
          useSolarStore.getState().setBackendSatellites(fresh);
        }
      }
    };

    const channel = kesslerSyncChannel;
    if (channel) {
      channel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('kessler:refresh-satellites', handleBroadcast);

    return () => {
      if (channel) {
        channel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('kessler:refresh-satellites', handleBroadcast);
    };
  }, []);

  // Keyboard navigation & ESC dismiss for HUD Notice and Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hudNotice) {
          setHudNotice(null);
          return;
        }
        if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hudNotice, isOpen]);

  const handleRegisterSatellite = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    console.log("🚨 [BUTTON CLICKED] Register/Stake button triggered! Handler: handleRegisterSatellite", {
      regName,
      regSatId,
      regNoradId,
      regStakeEth,
      walletAddress,
      isSubmitting,
      isGlobalTxPending,
      isCurrentRegDestroyed,
      isCurrentRegRegistered,
    });
    console.log("🔵 [REGISTER: START] Resolving Satellite target...", { regName, regSatId, regNoradId, regStakeEth, regPenaltyEth });

    if (isCurrentRegDestroyed) {
      console.warn("🔵 [REGISTER: BLOCKED] Asset is marked as DESTROYED.");
      setStatusMessage('ASSET OFFLINE: Registration disabled for destroyed assets.');
      return;
    }
    if (!walletAddress) {
      console.warn("🔵 [REGISTER: BLOCKED] Wallet not connected.");
      setStatusMessage('Please connect your MetaMask wallet first!');
      return;
    }
    const matchedCatalog = NORAD_SATELLITES.find(
      (s) => s.name === regName || s.name === regSatId || String(s.noradId) === regNoradId || s.id === regSatId
    );
    const selectedSat = matchedCatalog || currentRegSat || {
      noradId: parseInt(regNoradId, 10) || 0,
      norad_cat_id: parseInt(regNoradId, 10) || 0,
      id: regSatId,
      name: regName || regSatId,
    };

    // Strictly enforce NORAD ID as the on-chain mapping key
    const canonicalId = String(selectedSat.noradId || selectedSat.norad_cat_id || selectedSat.id).trim();
    const canonicalNorad = parseInt(canonicalId, 10) || selectedSat.noradId || (parseInt(regNoradId, 10) || 0);
    const displaySatName = selectedSat.name || regName || canonicalId;

    setIsGlobalTxPending(true);
    broadcastTxStarted();
    try {
      if (!isWeb3Connected) await web3Service.connectWallet();
      await web3Service.ensureHardhatNetwork();

      console.log("🔵 [REGISTER: ID RESOLVED] Canonical ID strictly evaluated as: ", canonicalId, {
        displaySatName,
        canonicalNorad,
        selectedSat,
      });

      const apiPayload = {
        satId: canonicalId,
        noradId: canonicalNorad,
        satelliteName: displaySatName,
        operatorAddress: walletAddress,
        stakedEth: parseFloat(regStakeEth),
        liabilityPenaltyEth: parseFloat(regPenaltyEth),
      };

      // Check if already registered on-chain
      console.log("🔵 [REGISTER: WEB3 CHECK] Checking if already registered on-chain...", { canonicalId });
      const alreadyRegistered = await web3Service.isRegisteredOnChain(canonicalId);
      console.log("🔵 [REGISTER: WEB3 CHECK RESULT] Is registered: ", alreadyRegistered);

      if (alreadyRegistered) {
        console.warn("🟠 [DESYNC DETECTED] Asset already on-chain but unregistered locally. Auto-healing database...");
        
        // 1. Sync to SQLite backend directly (bypass Web3 tx)
        const syncResult = await api.registerSatellite(apiPayload);
        
        // 2. Refresh the global Zustand store
        const fresh = await api.fetchSatellites();
        if (fresh?.length) {
          useSolarStore.getState().setBackendSatellites(fresh);
        } else if (syncResult?.satellite) {
          const healedRecord: BackendSatellite = {
            ...syncResult.satellite,
            sat_id: canonicalId,
            norad_cat_id: canonicalNorad,
            satellite_name: displaySatName,
            operator_address: walletAddress.toLowerCase(),
            staked_amount_eth: parseFloat(regStakeEth),
            operational_status: 'ACTIVE',
            isRegistered: true,
            is_registered: true,
            on_chain_status: 'REGISTERED',
            staked_eth: parseFloat(regStakeEth),
          } as any;
          const currentFleet = useSolarStore.getState().backendSatellites;
          const updatedFleet = [
            healedRecord,
            ...currentFleet.filter(
              (s) =>
                s.sat_id !== canonicalId &&
                s.satellite_name !== displaySatName &&
                (canonicalNorad ? Number(s.norad_cat_id) !== canonicalNorad : true)
            ),
          ];
          useSolarStore.getState().setBackendSatellites(updatedFleet);
        }
        setSelectedSatId(canonicalId);
        broadcastSatelliteRefresh();
        
        // 3. Log a special recovery transaction to the Right Drawer Ledger
        useSolarStore.getState().addWeb3Transaction({
          type: 'SYNC',
          satName: displaySatName,
          noradId: canonicalId,
          amount: parseFloat(regStakeEth),
          txHash: '0x_STATE_RECOVERY_SYNC',
          timestamp: Date.now(),
          actionType: 'ON-CHAIN STATE RECOVERED',
          satelliteName: displaySatName,
          valueEth: `SYNCED`,
        });

        // 4. Alert user via Aerospace HUD & exit function safely
        setHudNotice({
          title: 'STATE SYNC // RECOVERY COMPLETE',
          message: `Synchronized existing on-chain asset "${displaySatName}" into local database ledger.`,
          type: 'SUCCESS',
        });
        setStatusMessage(`✅ Synchronized existing on-chain asset "${displaySatName}" to local database.`);
        setIsSubmitting(false);
        return;
      }

      // Step 1: Execute on-chain registration transaction
      console.log("🔵 [REGISTER: WEB3] Sending to Smart Contract...", { canonicalId, stakeAmount: regStakeEth });
      const txHash = await web3Service.registerSatelliteOnChain(canonicalId, parseFloat(regStakeEth));
      console.log("🔵 [REGISTER: WEB3 SUCCESS] Tx Hash: ", txHash);
      console.log("🚀 [PIPELINE STEP 1: TX SUCCESS]", {
        action: 'REGISTER',
        txHash,
        canonicalId,
        displaySatName,
        amount: regStakeEth
      });

      // Step 2: Upon confirmed on-chain transaction, synchronize to backend SQLite
      console.log("🔵 [REGISTER: API] Syncing to SQLite Backend...", { payload: apiPayload });
      let syncResult: any = null;
      try {
        syncResult = await api.registerSatellite(apiPayload);
        console.log("🔵 [REGISTER: API SUCCESS] Sync response: ", syncResult);
      } catch (backendErr: any) {
        console.warn('SQLite DB registration note:', backendErr.message);
      }

      const updatedWallet = await web3Service.connectWallet();
      if (updatedWallet) setWalletState(updatedWallet);

      // Confirmed on-chain reactive state update with full property mappings
      const registeredRecord: BackendSatellite = {
        ...(syncResult?.satellite || {}),
        sat_id: canonicalId,
        norad_cat_id: canonicalNorad,
        satellite_name: displaySatName,
        operator_address: walletAddress.toLowerCase(),
        staked_amount_eth: parseFloat(regStakeEth),
        operational_status: 'ACTIVE',
        isRegistered: true,
        is_registered: true,
        on_chain_status: 'REGISTERED',
        staked_eth: parseFloat(regStakeEth),
      } as any;

      const currentFleet = useSolarStore.getState().backendSatellites;
      const updatedFleet = [
        registeredRecord,
        ...currentFleet.filter(
          (s) =>
            s.sat_id !== canonicalId &&
            s.satellite_name !== displaySatName &&
            (canonicalNorad ? Number(s.norad_cat_id) !== canonicalNorad : true)
        ),
      ];
      useSolarStore.getState().setBackendSatellites(updatedFleet);
      setSelectedSatId(canonicalId);

      // Trigger authoritative re-fetch in background
      api.fetchSatellites().then((fresh) => {
        if (fresh?.length) useSolarStore.getState().setBackendSatellites(fresh);
      });

      broadcastSatelliteRefresh();
      addAuditLog(`REGISTRATION: Satellite ${displaySatName} (NORAD #${canonicalId}) registered with ${regStakeEth} ETH collateral.`);
      const txPayload = {
        timestamp: new Date().toISOString(),
        actionType: 'SATELLITE REGISTERED',
        satelliteName: displaySatName,
        noradId: canonicalId,
        valueEth: `${parseFloat(regStakeEth).toFixed(2)} ETH`,
        txHash: txHash || undefined,
      };
      console.log("📦 [PIPELINE STEP 2: DISPATCHING TO STORE]", txPayload);
      useSolarStore.getState().addWeb3Transaction(txPayload);
      setStatusMessage(`Satellite ${displaySatName} registered on-chain (NORAD #${canonicalId}) and in SQLite! ${txHash ? '(Tx: ' + txHash.slice(0, 14) + '...)' : ''}`);
    } catch (err: any) {
      console.error("❌ [REGISTER: ERROR] Failed at: ", err.message, err);
      // Check if user rejected the transaction in MetaMask
      if (
        err?.code === 4001 ||
        err?.code === 'ACTION_REJECTED' ||
        err?.message?.toLowerCase().includes("user rejected") ||
        err?.info?.error?.code === 4001
      ) {
        useSolarStore.getState().addWeb3Transaction({
          type: 'REJECT',
          satName: displaySatName,
          noradId: canonicalId,
          amount: 0,
          txHash: 'USER_ABORTED',
          timestamp: Date.now(),
          actionType: 'TRANSACTION REJECTED',
          satelliteName: displaySatName,
          valueEth: 'ABORTED',
        });
        setStatusMessage(`⚠️ Registration cancelled by user in MetaMask.`);
      } else {
        setStatusMessage(`Registration error: ${err.message}`);
      }
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleSyncRestoreFleet = async () => {
    console.log("🟢 [SYNC: START] Restoring and refreshing fleet state...");
    setIsGlobalTxPending(true);
    broadcastTxStarted();
    setStatusMessage('⏳ Restoring fleet status and resetting 3D scene...');
    try {
      // 1. Call backend restore endpoint (revives DESTROYED -> NOMINAL, clears audit_logs)
      await api.restoreFleet();

      // 2. Clear local destroyed memory in Zustand
      useSolarStore.getState().clearDestroyed();

      // 3. Hydrate fresh satellites from backend
      const fresh = await api.fetchSatellites();
      console.log("🟢 [SYNC: SUCCESS] Zustand store hydrated with items: ", fresh?.length || 0, fresh);
      useSolarStore.getState().setBackendSatellites(fresh || []);

      // 4. Broadcast satellite refresh across tabs
      broadcastSatelliteRefresh();

      // 5. CRITICAL: Broadcast 3D scene / physics reset
      broadcastSceneReset();

      addAuditLog('FLEET RESTORE: Revived all destroyed satellites to NOMINAL, cleared collision logs, and reset 3D scene.');
      setStatusMessage('Fleet synchronized! Destroyed satellites revived and 3D scene reset.');
    } catch (err: any) {
      console.error("❌ [SYNC: ERROR] Fleet sync failed: ", err.message, err);
      setStatusMessage(`Sync restore error: ${err.message}`);
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleResetDemoState = async () => {
    setIsGlobalTxPending(true);
    broadcastTxStarted();
    console.warn("🟠 [RESET: START] Calling backend to clear SQLite dynamic rows...");
    setStatusMessage('⏳ Resetting demo database state...');
    try {
      const resetRes = await api.resetDemoDatabase();
      console.warn("🟠 [RESET: SUCCESS] Database wiped. Re-fetching fleet...", resetRes);
      useSolarStore.getState().clearDestroyed();
      const fresh = await api.fetchSatellites();
      console.log("🟠 [RESET: HYDRATED] Fleet re-fetched after reset, count:", fresh?.length || 0);
      useSolarStore.getState().setBackendSatellites(fresh || []);
      broadcastSatelliteRefresh();
      addAuditLog('DEMO RESET: Dynamic database rows cleared. Assets reverted to UNREGISTERED baseline.');
      setStatusMessage('Demo state reset! Dynamic records cleared. All satellites reverted to UNREGISTERED.');
    } catch (err: any) {
      console.error("❌ [RESET: ERROR] Demo reset failed: ", err.message, err);
      setStatusMessage(`Reset demo error: ${err.message}`);
    } finally {
      setIsGlobalTxPending(false);
      broadcastTxFinished();
    }
  };

  const handleFocusCyan = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderBottomColor = '#06b6d4';
    e.currentTarget.style.boxShadow = '0 6px 16px -4px rgba(6, 182, 212, 0.45)';
  };
  const handleBlurCyan = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderBottomColor = 'rgba(6, 182, 212, 0.4)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleFocusPink = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderBottomColor = '#ec4899';
    e.currentTarget.style.boxShadow = '0 6px 16px -4px rgba(236, 72, 153, 0.45)';
  };
  const handleBlurPink = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderBottomColor = 'rgba(236, 72, 153, 0.35)';
    e.currentTarget.style.boxShadow = 'none';
  };

  // Scaled up inputs: 48px height, 14px font, comfortable padding
  const baseInputStyle: React.CSSProperties = {
    width: '100%',
    height: '48px',
    background: 'rgba(0, 0, 0, 0.45)',
    border: 'none',
    borderBottom: '2px solid rgba(6, 182, 212, 0.4)',
    borderRadius: 0,
    padding: '0 16px',
    color: '#22d3ee',
    fontFamily: '"Space Mono", monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    outline: 'none',
    transition: 'border-bottom-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    boxSizing: 'border-box',
    MozAppearance: 'textfield' as any,
    appearance: 'textfield' as any,
  };

  const pinkInputStyle: React.CSSProperties = {
    ...baseInputStyle,
    borderBottom: '2px solid rgba(236, 72, 153, 0.4)',
    color: '#f9a8d4',
  };

  const monoTextStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    letterSpacing: '0.03em',
  };

  // Micro labels: minimum 10-11px, highly readable uppercase
  const microLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: '"Space Mono", monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontWeight: 800,
    color: '#64748b',
    display: 'block',
    marginBottom: '8px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  };

  const panelFrameStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 10002,
    background: 'rgba(2, 6, 23, 0.70)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    border: 'none',
    borderRight: '1px solid rgba(6, 182, 212, 0.35)',
    boxShadow: 'inset -10px 0 40px rgba(6, 182, 212, 0.08), 20px 0 60px rgba(0, 0, 0, 0.7)',
    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)',
    display: 'flex',
    flexDirection: 'column',
    color: '#e2e8f0',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    pointerEvents: 'auto',
    overflow: 'hidden',
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.35), rgba(6, 182, 212, 0.08) 60%, transparent)',
  };

  return (
    <>
      {/* 
        CLOSED STATE: Razor-thin vertical fiber-optic seam attached to left edge.
        Expands smoothly on hover to 28px revealing a sharp chevron.
      */}
      {/* 
        AEROSPACE ACTIVATION MODULE: LEFT EDGE (COMMAND CENTER)
        Compact tactical physical interface dock attached to the 3px full-height seam.
        Height: 84px | Width: 26px (resting) -> 32px (hover)
        Always visible on page load. Subtle at rest, responsive on hover.
      */}
      <motion.button
        type="button"
        aria-label={isOpen ? 'Collapse Command Center' : 'Open Command Center'}
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: isHovered || isFocused ? '32px' : '26px',
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          zIndex: 10001,
          overflow: 'visible',
          outline: 'none',
        }}
        title={isOpen ? 'Click to close Command Center' : 'Command Center // Click to deploy'}
      >
        {/* Full-Height 3px Seam Spine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '3px',
            height: '100vh',
            background: isHovered || isFocused
              ? 'linear-gradient(180deg, transparent 0%, rgba(6, 182, 212, 0.45) 15%, rgba(6, 182, 212, 0.9) 50%, rgba(6, 182, 212, 0.45) 85%, transparent 100%)'
              : 'linear-gradient(180deg, transparent 0%, rgba(6, 182, 212, 0.25) 15%, rgba(6, 182, 212, 0.6) 50%, rgba(6, 182, 212, 0.25) 85%, transparent 100%)',
            boxShadow: isHovered || isFocused
              ? '0 0 10px rgba(6, 182, 212, 0.6)'
              : '0 0 6px rgba(6, 182, 212, 0.25)',
            transition: 'all 0.16s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Compact Tactical Activation Dock (Height: 84px) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            width: isHovered || isFocused ? '32px' : '26px',
            height: '84px',
            background: isHovered || isFocused
              ? 'linear-gradient(90deg, rgba(2, 6, 23, 0.96) 0%, rgba(6, 182, 212, 0.16) 100%)'
              : 'linear-gradient(90deg, rgba(2, 6, 23, 0.84) 0%, rgba(6, 182, 212, 0.08) 100%)',
            backdropFilter: isHovered || isFocused ? 'blur(16px)' : 'blur(12px)',
            WebkitBackdropFilter: isHovered || isFocused ? 'blur(16px)' : 'blur(12px)',
            border: isHovered || isFocused
              ? '1px solid rgba(6, 182, 212, 0.75)'
              : '1px solid rgba(6, 182, 212, 0.4)',
            borderLeft: 'none',
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)',
            boxShadow: isHovered || isFocused
              ? '14px 0 28px rgba(0, 0, 0, 0.85), 3px 0 12px rgba(6, 182, 212, 0.45)'
              : '6px 0 16px rgba(0, 0, 0, 0.65), 1px 0 6px rgba(6, 182, 212, 0.25)',
            padding: '7px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'width 0.16s cubic-bezier(0.16, 1, 0.3, 1), background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {/* Micro Icon */}
          <Radio
            size={11}
            strokeWidth={2.2}
            style={{
              color: '#06b6d4',
              opacity: isHovered || isFocused ? 1 : 0.8,
              filter: isHovered || isFocused ? 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' : 'none',
              transition: 'all 0.16s ease',
            }}
          />

          {/* Micro Hairline Separator */}
          <div
            style={{
              width: '12px',
              height: '1px',
              background: 'rgba(6, 182, 212, 0.3)',
            }}
          />

          {/* Directional Chevron */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isHovered || isFocused ? '#22d3ee' : '#38bdf8',
              transition: 'all 0.16s ease',
            }}
          >
            {isOpen ? (
              <ChevronLeft size={11} strokeWidth={2.5} />
            ) : (
              <ChevronRight size={11} strokeWidth={2.5} />
            )}
          </div>

          {/* Micro Hairline Separator */}
          <div
            style={{
              width: '12px',
              height: '1px',
              background: 'rgba(6, 182, 212, 0.3)',
            }}
          />

          {/* Compact Technical Label Group */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                fontSize: '8px',
                fontFamily: '"Space Mono", monospace',
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: isHovered || isFocused ? '#67e8f9' : '#38bdf8',
                opacity: isHovered || isFocused ? 1 : 0.85,
                transition: 'all 0.16s ease',
              }}
            >
              CMD
            </span>
            <span
              style={{
                fontSize: '6.5px',
                fontFamily: '"Space Mono", monospace',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: isHovered || isFocused ? '#94a3b8' : '#64748b',
                opacity: isHovered || isFocused ? 1 : 0.75,
                transition: 'all 0.16s ease',
              }}
            >
              OPS
            </span>
          </div>
        </div>

        {/* Subtle Horizontal Light Accent (extends 8px on hover) */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '32px',
              transform: 'translateY(-50%)',
              width: '8px',
              height: '2px',
              background: 'linear-gradient(90deg, #22d3ee 0%, rgba(34, 211, 238, 0) 100%)',
              boxShadow: '0 0 6px #06b6d4',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.button>

      {/* 
        OPEN STATE: Full-screen aerospace glass command console extending across the full viewport.
        Slides smoothly from the left. Underlying planetary 3D scene remains clearly visible through the glass.
      */}
      <motion.aside
        className="cyber-drawer-root"
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 200, mass: 0.75 }}
        style={panelFrameStyle}
      >
        {/* Scoped CSS to eliminate native number spinner arrows and maintain pure aerospace input appearance */}
        <style>{`
          .cyber-drawer-root input[type="number"]::-webkit-inner-spin-button,
          .cyber-drawer-root input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none !important;
            margin: 0 !important;
          }
          .cyber-drawer-root input[type="number"] {
            -moz-appearance: textfield !important;
            appearance: textfield !important;
          }
        `}</style>
        {/* Subtle optical textures: faint scanline and soft radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: [
              'radial-gradient(circle at 60% 40%, rgba(34, 211, 238, 0.05), transparent 45%)',
              'linear-gradient(180deg, rgba(8, 20, 38, 0.2), transparent 25%, rgba(0, 0, 0, 0.2) 90%, rgba(6, 182, 212, 0.03))',
              'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0px, rgba(255, 255, 255, 0.01) 1px, transparent 1px, transparent 4px)',
            ].join(','),
            opacity: 0.85,
          }}
        />

        {/* Right-edge optical highlight */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            bottom: 14,
            right: 0,
            width: '1px',
            background: 'linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.7) 15%, rgba(34, 211, 238, 0.2) 80%, transparent)',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.65)',
            pointerEvents: 'none',
          }}
        />

        {/* ===================================================================
            TOP COMMAND HEADER (Dominant 38px typography & telemetry markers)
        =================================================================== */}
        <header
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: '32px',
            padding: '28px 54px 20px 54px',
            background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(2, 6, 23, 0.22) 100%)',
          }}
        >
          {/* Main Title Group */}
          <div>
            <div
              style={{
                ...monoTextStyle,
                fontSize: '11px',
                color: '#38bdf8',
                fontWeight: 800,
                letterSpacing: '0.16em',
                marginBottom: '4px',
              }}
            >
              SPACECRAFT HUD // PRIMARY INSTRUMENT ARRAY
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '38px',
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: '#f8fafc',
                lineHeight: 1.05,
                textTransform: 'uppercase',
                textShadow: '0 0 30px rgba(56, 189, 248, 0.22)',
              }}
            >
              COMMAND CENTER
            </h1>
            <div
              style={{
                ...monoTextStyle,
                fontSize: '12px',
                color: '#64748b',
                letterSpacing: '0.12em',
                marginTop: '6px',
              }}
            >
              ORBITAL OPERATIONS // STAKING / REGISTRATION / TELEMETRY
            </div>
          </div>

          {/* Center telemetry separator track */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              padding: '0 16px',
              opacity: 0.75,
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'rgba(100, 116, 139, 0.25)' }} />
            <div
              style={{
                ...monoTextStyle,
                fontSize: '11px',
                color: '#64748b',
                letterSpacing: '0.14em',
                whiteSpace: 'nowrap',
              }}
            >
              GRID REF: 51.64°N // ALT 408 KM // EPOCH 2026.4
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(100, 116, 139, 0.25)' }} />
          </div>

          {/* Right Header Controls & Status Readouts */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '28px',
            }}
          >
            {/* System Uplink Status Pill */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
              }}
            >
              <div
                style={{
                  ...monoTextStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: isWeb3Connected ? '#34d399' : '#f59e0b',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isWeb3Connected ? '#34d399' : '#f59e0b',
                    boxShadow: `0 0 12px ${isWeb3Connected ? 'rgba(52, 211, 153, 0.85)' : 'rgba(245, 158, 11, 0.85)'}`,
                  }}
                />
                {isWeb3Connected ? 'UPLINK ACTIVE' : 'UPLINK STANDBY'}
              </div>
              <div
                style={{
                  ...monoTextStyle,
                  fontSize: '10px',
                  color: '#64748b',
                  letterSpacing: '0.1em',
                }}
              >
                NETWORK: HARDHAT // EVID-31337
              </div>
            </div>

            {/* Aerospace Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Close Command Console (ESC)"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(100, 116, 139, 0.35)',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '10px 18px',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11px',
                fontFamily: '"Space Mono", monospace, ui-monospace',
                fontWeight: 800,
                letterSpacing: '0.14em',
                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.35)';
              }}
            >
              <span>CLOSE HUD</span>
              <X size={15} />
            </button>
          </div>
        </header>

        <div style={dividerStyle} />

        {/* Subsystem Mode Selectors: High-contrast angular cockpit selectors */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 54px 0 54px',
            background: 'rgba(0, 0, 0, 0.22)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setActiveSection('staking')}
              style={{
                position: 'relative',
                minHeight: '48px',
                padding: '0 30px',
                border: 'none',
                borderBottom: activeSection === 'staking' ? '3px solid #06b6d4' : '3px solid rgba(100, 116, 139, 0.2)',
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
                background: activeSection === 'staking' ? 'rgba(6, 182, 212, 0.14)' : 'rgba(2, 6, 23, 0.35)',
                color: activeSection === 'staking' ? '#67e8f9' : '#64748b',
                fontSize: '12px',
                fontFamily: '"Space Mono", monospace, ui-monospace',
                fontWeight: 800,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
              }}
            >
              <Coins size={18} />
              <span>01 // COLLATERAL STAKING</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('register')}
              style={{
                position: 'relative',
                minHeight: '48px',
                padding: '0 30px',
                border: 'none',
                borderBottom: activeSection === 'register' ? '3px solid #ec4899' : '3px solid rgba(100, 116, 139, 0.2)',
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
                background: activeSection === 'register' ? 'rgba(236, 72, 153, 0.14)' : 'rgba(2, 6, 23, 0.35)',
                color: activeSection === 'register' ? '#f9a8d4' : '#64748b',
                fontSize: '12px',
                fontFamily: '"Space Mono", monospace, ui-monospace',
                fontWeight: 800,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textTransform: 'uppercase',
                transition: 'all 0.15s ease',
              }}
            >
              <Radio size={18} />
              <span>02 // ASSET REGISTRATION</span>
            </button>
          </div>

          <div
            style={{
              ...monoTextStyle,
              fontSize: '11px',
              color: '#64748b',
              letterSpacing: '0.12em',
              display: 'flex',
              gap: '24px',
            }}
          >
            <span>CATALOG: <strong style={{ color: '#e2e8f0' }}>{fleetCounts.catalog}</strong></span>
            <span>ON-CHAIN: <strong style={{ color: '#34d399' }}>{fleetCounts.registered}</strong></span>
            <span>CASUALTIES: <strong style={{ color: '#f43f5e' }}>{fleetCounts.destroyed}</strong></span>
          </div>
        </div>

        {/* Global Status Banner (when status message exists) */}
        {statusMessage && (
          <div
            style={{
              margin: '14px 54px 0',
              background: statusMessage.includes('error') || statusMessage.includes('OFFLINE')
                ? 'rgba(244, 63, 94, 0.09)'
                : 'rgba(6, 182, 212, 0.09)',
              borderLeft: statusMessage.includes('error') || statusMessage.includes('OFFLINE')
                ? '3px solid #f43f5e'
                : '3px solid #06b6d4',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '12px 20px',
              fontSize: '12px',
              color: statusMessage.includes('error') || statusMessage.includes('OFFLINE') ? '#fb7185' : '#67e8f9',
              ...monoTextStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {statusMessage.includes('error') || statusMessage.includes('OFFLINE') ? (
              <AlertTriangle size={18} style={{ color: '#f43f5e', flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: '#06b6d4', flexShrink: 0 }} />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ===================================================================
            MAIN COCKPIT BODY: FULL-SCREEN MULTI-ZONE COMMAND SURFACE
            Proportions: Left ~30%, Center ~42% (hero), Right ~28%
        =================================================================== */}
        <main
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '28px 54px 36px',
            display: 'grid',
            gridTemplateColumns: 'minmax(330px, 30%) minmax(440px, 42%) minmax(320px, 28%)',
            gap: '36px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(6, 182, 212, 0.4) transparent',
          }}
        >
          {/* ===================================================================
              ZONE 1 (LEFT COLUMN ~30%): REAL 3D SATELLITE INSPECTION MODULE
          =================================================================== */}
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Zone Title */}
            <div>
              <div style={microLabelStyle}>ZONE 01 // TELEMETRY</div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  color: '#f8fafc',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                ORBITAL TARGET
              </div>
            </div>

            {/* 
              PRIMARY 3D SATELLITE INSPECTION VIEWPORT (260px)
              Renders the actual 3D model, geometries, and procedural textures used in the solar-system scene.
              Immediately updates when the user switches satellite in Staking or Registration.
            */}
            {isOpen && (
              <Satellite3DInspectionViewport
                sat={activeDisplaySat}
                isDestroyed={activeDisplayStatus === 'DESTROYED'}
              />
            )}

            {/* Target Asset Identity Strip with professional classification icon, badge, and status */}
            <div
              style={{
                padding: '20px 22px',
                background: 'rgba(0, 0, 0, 0.38)',
                borderBottom: '1px solid rgba(6, 182, 212, 0.25)',
                borderTop: '1px solid rgba(6, 182, 212, 0.1)',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Classification Pill with Aerospace Technical Vector Icon */}
              {activeClassification && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(2, 6, 23, 0.75)',
                    border: `1px solid ${activeClassification.color}40`,
                    borderLeft: `3px solid ${activeClassification.color}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '2px',
                        background: `${activeClassification.color}18`,
                        border: `1px solid ${activeClassification.color}60`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: activeClassification.color,
                        boxShadow: `0 0 12px ${activeClassification.color}30`,
                      }}
                    >
                      <activeClassification.icon size={15} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 900,
                          color: activeClassification.color,
                          letterSpacing: '0.12em',
                          lineHeight: 1,
                        }}
                      >
                        {activeClassification.label}
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 700,
                          color: '#64748b',
                          letterSpacing: '0.14em',
                          marginTop: '3px',
                        }}
                      >
                        CLASS REF // {activeClassification.code}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '10px',
                      fontFamily: '"Space Mono", monospace',
                      fontWeight: 800,
                      color: '#38bdf8',
                      letterSpacing: '0.12em',
                      padding: '3px 8px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    OPTICAL LOCK
                  </div>
                </div>
              )}

              {/* Satellite Designation & NORAD Catalog */}
              <div>
                <div style={microLabelStyle}>DESIGNATION & NORAD ID</div>
                <div
                  style={{
                    ...monoTextStyle,
                    fontSize: '26px',
                    fontWeight: 900,
                    color: '#67e8f9',
                    lineHeight: 1.15,
                    textShadow: '0 0 16px rgba(34, 211, 238, 0.2)',
                  }}
                >
                  {activeDisplaySat.name}
                </div>
                <div
                  style={{
                    ...monoTextStyle,
                    fontSize: '14px',
                    color: '#94a3b8',
                    fontWeight: 700,
                    marginTop: '6px',
                  }}
                >
                  NORAD CATALOG #{activeDisplaySat.noradId} // {activeDisplaySat.intlDes || 'LEO'}
                </div>
              </div>

              {/* Status & Tracking Grid */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontFamily: '"Space Mono", monospace',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    background: activeDisplayStatus === 'DESTROYED'
                      ? 'rgba(244, 63, 94, 0.18)'
                      : activeDisplayStatus === 'REGISTERED'
                      ? 'rgba(52, 211, 153, 0.18)'
                      : 'rgba(100, 116, 139, 0.18)',
                    color: activeDisplayStatus === 'DESTROYED'
                      ? '#fb7185'
                      : activeDisplayStatus === 'REGISTERED'
                      ? '#34d399'
                      : '#cbd5e1',
                    border: `1px solid ${
                      activeDisplayStatus === 'DESTROYED'
                        ? 'rgba(244, 63, 94, 0.45)'
                        : activeDisplayStatus === 'REGISTERED'
                        ? 'rgba(52, 211, 153, 0.45)'
                        : 'rgba(100, 116, 139, 0.35)'
                    }`,
                  }}
                >
                  {activeDisplayStatus === 'DESTROYED' ? (
                    <>
                      <Skull size={14} />
                      OFFLINE // DESTROYED
                    </>
                  ) : activeDisplayStatus === 'REGISTERED' ? (
                    <>
                      <CheckCircle2 size={14} />
                      REGISTERED
                    </>
                  ) : (
                    <>
                      <Activity size={14} />
                      UNREGISTERED
                    </>
                  )}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontFamily: '"Space Mono", monospace',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    background: 'rgba(6, 182, 212, 0.12)',
                    color: '#22d3ee',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                  }}
                >
                  <Crosshair size={13} />
                  TRACK // LOCKED
                </span>
              </div>
            </div>

            {/* Target Telemetry Breakdown with real data */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '20px 22px',
                background: 'rgba(0, 0, 0, 0.28)',
                borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <div style={microLabelStyle}>ON-CHAIN COLLATERAL STATE</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...monoTextStyle, fontSize: '13px', color: '#94a3b8' }}>ACTIVE STAKE:</span>
                <span style={{ ...monoTextStyle, fontSize: '20px', fontWeight: 900, color: '#22d3ee' }}>
                  {selectedBackendRecord?.staked_amount_eth !== undefined && selectedBackendRecord?.staked_amount_eth !== null
                    ? `${Number(selectedBackendRecord.staked_amount_eth).toFixed(2)} ETH`
                    : '0.00 ETH'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...monoTextStyle, fontSize: '13px', color: '#94a3b8' }}>LIABILITY BOND:</span>
                <span style={{ ...monoTextStyle, fontSize: '18px', fontWeight: 800, color: '#ec4899' }}>
                  {selectedBackendRecord?.liability_bond_eth !== undefined && selectedBackendRecord?.liability_bond_eth !== null
                    ? `${Number(selectedBackendRecord.liability_bond_eth).toFixed(2)} ETH`
                    : (selectedBackendRecord?.liability_penalty_eth !== undefined && selectedBackendRecord?.liability_penalty_eth !== null
                      ? `${Number(selectedBackendRecord.liability_penalty_eth).toFixed(2)} ETH`
                      : '5.00 ETH')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ ...monoTextStyle, fontSize: '13px', color: '#94a3b8' }}>OPERATOR:</span>
                <span style={{ ...monoTextStyle, fontSize: '13px', color: '#cbd5e1', fontWeight: 700 }}>
                  {selectedBackendRecord?.operator_address
                    ? `${selectedBackendRecord.operator_address.slice(0, 8)}...${selectedBackendRecord.operator_address.slice(-4)}`
                    : (activeDisplaySat.operator || 'UNASSIGNED')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '6px', borderTop: '1px solid rgba(100, 116, 139, 0.15)' }}>
                <span style={{ ...monoTextStyle, fontSize: '11px', color: '#64748b' }}>ALT / VELOCITY:</span>
                <span style={{ ...monoTextStyle, fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
                  {activeDisplaySat.altitudeKm} KM // {activeDisplaySat.velocityKmh ? (activeDisplaySat.velocityKmh / 3600).toFixed(2) : '7.66'} KM/S
                </span>
              </div>
            </div>
          </section>

          {/* ===================================================================
              ZONE 2 (CENTER COLUMN ~42%): MAIN OPERATIONAL MODULE (HERO FOCUS)
          =================================================================== */}
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Zone Title */}
            <div>
              <div style={{ ...microLabelStyle, color: activeSection === 'staking' ? '#06b6d4' : '#ec4899' }}>
                ZONE 02 // {activeSection === 'staking' ? 'COLLATERAL DEPLOYMENT' : 'ASSET REGISTRATION'}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: '#f8fafc',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {activeSection === 'staking' ? 'DEPLOY COLLATERAL' : 'REGISTER SATELLITE'}
              </div>
            </div>

            {/* STAKING FORM */}
            {activeSection === 'staking' && (
              <form onSubmit={handleExecuteStake} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Selector with Custom Dark Aerospace Dropdown (No white scrollbar, technical vector icons) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <label style={{ ...microLabelStyle, marginBottom: 0 }}>
                      SELECT SATELLITE TO COLLATERALIZE
                    </label>
                  </div>

                  <AerospaceSatelliteDropdown
                    satellites={uniqueNoradSatellites}
                    selectedValue={selectedSatId}
                    onSelect={(val) => setSelectedSatId(val)}
                    getSatelliteStatus={getSatelliteStatus}
                    accentTheme="cyan"
                    disabled={isSubmitting || isGlobalTxPending}
                  />
                </div>

                {/* Destroyed Alert */}
                {isCurrentStakingDestroyed && (
                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      borderLeft: '3px solid #f43f5e',
                      borderBottom: '1px solid rgba(244, 63, 94, 0.25)',
                      padding: '16px 18px',
                      fontSize: '13px',
                      ...monoTextStyle,
                      color: '#fb7185',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <Skull size={18} style={{ color: '#f43f5e', flexShrink: 0 }} />
                    <span>ASSET OFFLINE: Staking is disabled for destroyed or de-orbited assets.</span>
                  </div>
                )}

                {/* Stake Amount Input with Prominent Typography */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <label style={microLabelStyle}>
                      STAKE AMOUNT (ETH)
                    </label>
                    <span style={{ ...monoTextStyle, fontSize: '12px', color: '#64748b' }}>
                      WALLET AVAILABLE: <strong style={{ color: '#22d3ee' }}>{walletBalanceEth} ETH</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={stakeAmountEth}
                    disabled={isCurrentStakingDestroyed}
                    onChange={(e) => setStakeAmountEth(e.target.value)}
                    onFocus={handleFocusCyan}
                    onBlur={handleBlurCyan}
                    style={{
                      ...baseInputStyle,
                      height: '52px',
                      fontSize: '18px',
                      fontWeight: 900,
                    }}
                  />

                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    {['0.5', '1.0', '2.5', '5.0'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={isCurrentStakingDestroyed}
                        onClick={() => setStakeAmountEth(amt)}
                        style={{
                          flex: 1,
                          height: '38px',
                          border: '1px solid rgba(100, 116, 139, 0.3)',
                          background: stakeAmountEth === amt ? 'rgba(6, 182, 212, 0.18)' : 'rgba(0, 0, 0, 0.35)',
                          color: stakeAmountEth === amt ? '#22d3ee' : '#94a3b8',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: '"Space Mono", monospace',
                          cursor: isCurrentStakingDestroyed ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {amt} ETH
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical Execution Parameters Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.32)',
                    borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                  }}
                >
                  <div>
                    <div style={microLabelStyle}>TRANSACTION TYPE</div>
                    <div style={{ ...monoTextStyle, color: '#f1f5f9', fontSize: '13px', fontWeight: 800 }}>
                      WEB3 / ON-CHAIN
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>SETTLEMENT</div>
                    <div style={{ ...monoTextStyle, color: '#f1f5f9', fontSize: '13px', fontWeight: 800 }}>
                      ETH COLLATERAL
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>PROTOCOL CONTRACT</div>
                    <div style={{ ...monoTextStyle, color: '#94a3b8', fontSize: '12px' }}>
                      KESSLER_STAKE.SOL
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>GAS ESTIMATE</div>
                    <div style={{ ...monoTextStyle, color: '#34d399', fontSize: '12px', fontWeight: 700 }}>
                      ~0.0014 ETH (LOCAL)
                    </div>
                  </div>
                </div>

                {/* Action Trigger Button */}
                <div
                  onClickCapture={() => {
                    console.log("🚨 [BUTTON AREA CLICK CAPTURE: STAKE]", {
                      isStakeDisabled,
                      isSubmitting,
                      isGlobalTxPending,
                      currentStakingStatus,
                      isCurrentStakingDestroyed,
                      selectedSatId
                    });
                  }}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <button
                    type="submit"
                    onClick={handleExecuteStake}
                    disabled={isStakeDisabled}
                    title={currentStakingStatus !== 'REGISTERED' ? "Satellite must be registered before staking." : undefined}
                    style={{
                      width: '100%',
                      minHeight: '62px',
                      padding: '16px 28px',
                      borderRadius: 0,
                      border: isStakeDisabled
                        ? '1px solid rgba(100, 116, 139, 0.4)'
                        : '1px solid rgba(6, 182, 212, 0.45)',
                      borderBottom: isStakeDisabled
                        ? '3px solid rgba(100, 116, 139, 0.6)'
                        : '3px solid rgba(6, 182, 212, 0.85)',
                      background: isStakeDisabled ? 'rgba(15, 23, 42, 0.45)' : 'rgba(6, 182, 212, 0.15)',
                      color: isStakeDisabled ? '#64748b' : '#67e8f9',
                      fontSize: '13px',
                      fontFamily: '"Space Mono", monospace, ui-monospace',
                      fontWeight: 900,
                      letterSpacing: '0.14em',
                      cursor: isStakeDisabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
                      boxShadow: isStakeDisabled ? 'none' : 'inset 0 0 24px rgba(6, 182, 212, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>
                      {isSubmitting
                        ? 'TRANSACTING WITH EVM...'
                        : isCurrentStakingDestroyed
                        ? 'STAKING BLOCKED // OFFLINE'
                        : currentStakingStatus !== 'REGISTERED'
                        ? 'STAKING BLOCKED // UNREGISTERED'
                        : 'DEPLOY COLLATERAL TO CHAIN'}
                    </span>
                    {isSubmitting ? (
                      <Activity size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : isCurrentStakingDestroyed ? (
                      <Skull size={20} />
                    ) : currentStakingStatus !== 'REGISTERED' ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <Coins size={20} />
                    )}
                  </button>
                </div>
                {currentStakingStatus !== 'REGISTERED' && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      fontFamily: '"Space Mono", monospace',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <AlertTriangle size={13} />
                    <span>Satellite must be registered before staking.</span>
                  </div>
                )}
              </form>
            )}

            {/* REGISTRATION FORM */}
            {activeSection === 'register' && (
              <form onSubmit={handleRegisterSatellite} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Catalog Autofill Preset with Dark Aerospace Dropdown (No white scrollbar, magenta styling) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <label style={{ ...microLabelStyle, color: '#ec4899', marginBottom: 0 }}>
                      CATALOG AUTOFILL PRESET
                    </label>
                  </div>

                  <AerospaceSatelliteDropdown
                    satellites={uniqueNoradSatellites}
                    selectedValue={regName}
                    onSelect={(val) => {
                      const found = allAvailableSatellites.find((s) => s.name === val || String(s.noradId) === val || s.id === val);
                      if (found) {
                        setRegSatId(found.name);
                        setRegNoradId(found.noradId.toString());
                        setRegName(found.name);
                      }
                    }}
                    getSatelliteStatus={getSatelliteStatus}
                    accentTheme="magenta"
                    disabled={isSubmitting || isGlobalTxPending}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
                  <div>
                    <label style={microLabelStyle}>
                      SATELLITE ID / NAME
                    </label>
                    <input
                      type="text"
                      value={regName}
                      disabled={isCurrentRegDestroyed}
                      onChange={(e) => {
                        setRegName(e.target.value);
                        setRegSatId(e.target.value);
                      }}
                      onFocus={handleFocusPink}
                      onBlur={handleBlurPink}
                      style={{
                        ...pinkInputStyle,
                        height: '50px',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={microLabelStyle}>
                      NORAD CATALOG ID
                    </label>
                    <input
                      type="number"
                      value={regNoradId}
                      disabled={isCurrentRegDestroyed}
                      onChange={(e) => setRegNoradId(e.target.value)}
                      onFocus={handleFocusPink}
                      onBlur={handleBlurPink}
                      style={{
                        ...pinkInputStyle,
                        height: '50px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={microLabelStyle}>
                      STAKE (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={regStakeEth}
                      disabled={isCurrentRegDestroyed}
                      onChange={(e) => setRegStakeEth(e.target.value)}
                      onFocus={handleFocusPink}
                      onBlur={handleBlurPink}
                      style={{
                        ...pinkInputStyle,
                        height: '50px',
                        fontSize: '16px',
                        fontWeight: 800,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ ...microLabelStyle, color: '#ec4899' }}>
                      PENALTY (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={regPenaltyEth}
                      disabled={isCurrentRegDestroyed}
                      onChange={(e) => setRegPenaltyEth(e.target.value)}
                      onFocus={handleFocusPink}
                      onBlur={handleBlurPink}
                      style={{
                        ...pinkInputStyle,
                        height: '50px',
                        fontSize: '16px',
                        fontWeight: 800,
                      }}
                    />
                  </div>
                </div>

                {/* Network & Registry Matrix */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.32)',
                    borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                  }}
                >
                  <div>
                    <div style={microLabelStyle}>NETWORK TARGET</div>
                    <div style={{ ...monoTextStyle, color: '#f1f5f9', fontSize: '13px', fontWeight: 800 }}>
                      HARDHAT // TESTNET
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>REGISTRY STATE</div>
                    <div style={{ ...monoTextStyle, color: '#f1f5f9', fontSize: '13px', fontWeight: 800 }}>
                      SQLITE + CHAIN CONTRACT
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>OPERATOR ASSIGNMENT</div>
                    <div style={{ ...monoTextStyle, color: '#f472b6', fontSize: '12px', fontWeight: 700 }}>
                      {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-4)}` : 'DISCONNECTED'}
                    </div>
                  </div>
                  <div>
                    <div style={microLabelStyle}>CROSS-TAB BROADCAST</div>
                    <div style={{ ...monoTextStyle, color: '#34d399', fontSize: '12px', fontWeight: 700 }}>
                      ACTIVE CHANNEL
                    </div>
                  </div>
                </div>

                {isCurrentRegDestroyed && (
                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      borderLeft: '3px solid #f43f5e',
                      padding: '16px 18px',
                      fontSize: '13px',
                      ...monoTextStyle,
                      color: '#fb7185',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <Skull size={18} style={{ color: '#f43f5e', flexShrink: 0 }} />
                    <span>ASSET OFFLINE: Registration disabled for destroyed assets.</span>
                  </div>
                )}

                {isCurrentRegRegistered && !isCurrentRegDestroyed && (
                  <div
                    style={{
                      background: 'rgba(52, 211, 153, 0.1)',
                      borderLeft: '3px solid #34d399',
                      padding: '16px 18px',
                      fontSize: '13px',
                      ...monoTextStyle,
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                    <span>ASSET REGISTERED ON-CHAIN: Duplicate registration disabled. Switch to Staking tab to add collateral.</span>
                  </div>
                )}

                <div
                  onClickCapture={() => {
                    console.log("🚨 [BUTTON AREA CLICK CAPTURE: REGISTER]", {
                      isSubmitting,
                      isGlobalTxPending,
                      isCurrentRegDestroyed,
                      isCurrentRegRegistered,
                      regName,
                      regNoradId,
                      walletAddress
                    });
                  }}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <button
                    type="submit"
                    onClick={handleRegisterSatellite}
                    disabled={isSubmitting || isCurrentRegDestroyed || isCurrentRegRegistered}
                    style={{
                      width: '100%',
                      minHeight: '62px',
                      padding: '16px 28px',
                      borderRadius: 0,
                      border: '1px solid rgba(236, 72, 153, 0.45)',
                      borderBottom: '3px solid rgba(236, 72, 153, 0.85)',
                      background: (isCurrentRegDestroyed || isCurrentRegRegistered) ? 'rgba(15, 23, 42, 0.45)' : 'rgba(236, 72, 153, 0.15)',
                      color: (isCurrentRegDestroyed || isCurrentRegRegistered) ? '#64748b' : '#f9a8d4',
                      fontSize: '13px',
                      fontFamily: '"Space Mono", monospace, ui-monospace',
                      fontWeight: 900,
                      letterSpacing: '0.14em',
                      cursor: (isSubmitting || isCurrentRegDestroyed || isCurrentRegRegistered) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
                      boxShadow: (isCurrentRegDestroyed || isCurrentRegRegistered) ? 'none' : 'inset 0 0 24px rgba(236, 72, 153, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>
                      {isSubmitting
                        ? 'COMMITTING TO CHAIN...'
                        : isCurrentRegDestroyed
                        ? 'REGISTRATION BLOCKED // OFFLINE'
                        : isCurrentRegRegistered
                        ? 'ALREADY REGISTERED ON-CHAIN'
                        : 'COMMIT REGISTRATION ON-CHAIN'}
                    </span>
                    {isSubmitting ? (
                      <Activity size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : isCurrentRegDestroyed ? (
                      <Skull size={20} />
                    ) : isCurrentRegRegistered ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Radio size={20} />
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* ===================================================================
              ZONE 3 (RIGHT COLUMN ~28%): WALLET UPLINK & GLOBAL SYSTEM MONITOR
          =================================================================== */}
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Zone Title */}
            <div>
              <div style={microLabelStyle}>ZONE 03 // UPLINK</div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  color: '#f8fafc',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                WALLET & PROTOCOL
              </div>
            </div>

            {/* Wallet Telemetry Block with Large 34px Balance & 3D Holographic MetaMask Watermark */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '22px',
                background: 'rgba(0, 0, 0, 0.38)',
                borderBottom: '1px solid rgba(6, 182, 212, 0.25)',
                borderTop: '1px solid rgba(6, 182, 212, 0.1)',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
              }}
            >
              {/* Large 300x300 Thematic 3D Holographic MetaMask Fox Watermark */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-35px',
                  right: '-35px',
                  perspective: '1000px',
                  transformStyle: 'preserve-3d',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              >
                <MetaMaskWatermark
                  size={300}
                  color="#00F0FF"
                  strokeWidth={0.5}
                  opacity={0.25}
                  style={{
                    transform: 'perspective(1000px) rotateX(15deg) rotateY(-10deg) rotateZ(12deg)',
                    filter: 'drop-shadow(0 0 15px rgba(0, 240, 255, 0.35)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5))',
                  }}
                />
              </div>

              {/* Foreground UI Elements (relative z-10) */}
              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ ...microLabelStyle, marginBottom: 0 }}>METAMASK OPERATOR LINK</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      backdropFilter: 'blur(4px)',
                      marginTop: '2px',
                    }}
                  >
                    <MetaMaskFoxIcon size={20} style={{ filter: 'drop-shadow(0 0 4px rgba(246, 133, 27, 0.45))' }} />
                    <span
                      style={{
                        ...monoTextStyle,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: isWeb3Connected ? '#38bdf8' : '#f59e0b',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {isWeb3Connected ? `${walletAddress?.slice(0, 10)}...${walletAddress?.slice(-6)}` : 'DISCONNECTED'}
                    </span>
                    {isWeb3Connected && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '9px',
                          padding: '2px 6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          borderRadius: '2px',
                          color: '#34d399',
                          fontFamily: '"Space Mono", monospace',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >
                        ONLINE
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '18px' }}>
                  <div style={microLabelStyle}>AVAILABLE COLLATERAL BALANCE</div>
                  <div
                    style={{
                      ...monoTextStyle,
                      fontSize: '34px',
                      fontWeight: 900,
                      color: '#67e8f9',
                      textShadow: '0 0 20px rgba(34, 211, 238, 0.35)',
                      lineHeight: 1.1,
                    }}
                  >
                    {walletBalanceEth} <span style={{ fontSize: '16px', color: '#64748b' }}>ETH</span>
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                  {isWeb3Connected ? (
                    <button
                      type="button"
                      onClick={handleClaimFaucet}
                      disabled={isSubmitting}
                      title="Claim 100 Test ETH from Hardhat Faucet"
                      style={{
                        flex: 1,
                        height: '46px',
                        padding: '0 16px',
                        border: '1px solid rgba(52, 211, 153, 0.45)',
                        borderRadius: 0,
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#6ee7b7',
                        fontSize: '12px',
                        fontFamily: '"Space Mono", monospace, ui-monospace',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                      }}
                    >
                      +100 TEST ETH FAUCET
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectWallet}
                      style={{
                        flex: 1,
                        height: '46px',
                        padding: '0 16px',
                        border: '1px solid rgba(6, 182, 212, 0.45)',
                        borderRadius: 0,
                        background: 'rgba(6, 182, 212, 0.14)',
                        color: '#67e8f9',
                        fontSize: '12px',
                        fontFamily: '"Space Mono", monospace, ui-monospace',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        cursor: 'pointer',
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                      }}
                    >
                      CONNECT METAMASK
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Global Fleet System Counters (Large 26px numbers) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
                position: 'relative',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  padding: '18px',
                  background: 'rgba(0, 0, 0, 0.32)',
                  borderBottom: '1px solid rgba(6, 182, 212, 0.2)',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Database size={15} style={{ color: '#06b6d4' }} />
                  <span style={microLabelStyle}>CATALOG</span>
                </div>
                <div style={{ ...monoTextStyle, fontSize: '26px', fontWeight: 900, color: '#f8fafc' }}>
                  {fleetCounts.catalog}
                </div>
                <div style={{ ...monoTextStyle, fontSize: '11px', color: '#64748b' }}>NORAD ORBITS</div>
              </div>

              <div
                style={{
                  padding: '18px',
                  background: 'rgba(0, 0, 0, 0.32)',
                  borderBottom: '1px solid rgba(52, 211, 153, 0.2)',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldAlert size={15} style={{ color: '#34d399' }} />
                  <span style={microLabelStyle}>REGISTERED</span>
                </div>
                <div style={{ ...monoTextStyle, fontSize: '26px', fontWeight: 900, color: '#34d399' }}>
                  {fleetCounts.registered}
                </div>
                <div style={{ ...monoTextStyle, fontSize: '11px', color: '#64748b' }}>COLLATERALIZED</div>
              </div>

              <div
                style={{
                  padding: '18px',
                  background: 'rgba(0, 0, 0, 0.32)',
                  borderBottom: '1px solid rgba(244, 63, 94, 0.2)',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Skull size={15} style={{ color: '#f43f5e' }} />
                  <span style={microLabelStyle}>DESTROYED</span>
                </div>
                <div style={{ ...monoTextStyle, fontSize: '26px', fontWeight: 900, color: '#f43f5e' }}>
                  {fleetCounts.destroyed}
                </div>
                <div style={{ ...monoTextStyle, fontSize: '11px', color: '#64748b' }}>COLLISION IMPACTS</div>
              </div>

              <div
                style={{
                  padding: '18px',
                  background: 'rgba(0, 0, 0, 0.32)',
                  borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Cpu size={15} style={{ color: '#94a3b8' }} />
                  <span style={microLabelStyle}>NODE HEALTH</span>
                </div>
                <div style={{ ...monoTextStyle, fontSize: '16px', fontWeight: 900, color: '#34d399', paddingTop: '6px' }}>
                  100% OK
                </div>
                <div style={{ ...monoTextStyle, fontSize: '11px', color: '#64748b' }}>IPC CHANNELS</div>
              </div>
            </div>

            {/* Protocol Security & Audit Notice */}
            <div
              style={{
                padding: '18px 20px',
                background: 'rgba(6, 182, 212, 0.04)',
                border: '1px solid rgba(6, 182, 212, 0.18)',
                fontSize: '12px',
                lineHeight: 1.6,
                color: '#94a3b8',
                ...monoTextStyle,
              }}
            >
              <div style={{ color: '#38bdf8', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.08em', fontSize: '12px' }}>
                SECURITY & AUDIT PROTOCOL
              </div>
              <div>
                On-chain collateral penalties trigger automatically upon physical collision detection. Cross-tab events are synchronised across the broadcast channel.
              </div>
            </div>

            {/* ===================================================================
                ADMINISTRATIVE DEMO LIFECYCLE CONTROLS (AAA FPOV AEROSPACE UI)
            =================================================================== */}
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(2, 6, 23, 0.45)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderLeft: '3px solid #06b6d4',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={14} style={{ color: '#06b6d4' }} />
                  <span style={{ ...microLabelStyle, color: '#38bdf8', letterSpacing: '0.12em', marginBottom: 0 }}>
                    DEMO LIFECYCLE CONTROLS
                  </span>
                </div>
                <span style={{ ...monoTextStyle, fontSize: '10px', color: '#64748b' }}>
                  ADMIN ENGINE // ROOT
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                {/* Button 1: SYNC / RESTORE FLEET */}
                <button
                  type="button"
                  onClick={handleSyncRestoreFleet}
                  disabled={isSubmitting}
                  title="Restores fleet UI state and clears destroyed memory before collision"
                  style={{
                    height: '44px',
                    padding: '0 12px',
                    border: '1px solid rgba(6, 182, 212, 0.45)',
                    borderRadius: 0,
                    background: 'rgba(6, 182, 212, 0.1)',
                    color: '#67e8f9',
                    fontSize: '11px',
                    fontFamily: '"Space Mono", monospace, ui-monospace',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = 'rgba(6, 182, 212, 0.22)';
                      e.currentTarget.style.borderColor = '#06b6d4';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(6, 182, 212, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.45)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <RefreshCw size={13} />
                  <span>SYNC / RESTORE FLEET</span>
                </button>

                {/* Button 2: RESET DEMO STATE */}
                <button
                  type="button"
                  onClick={handleResetDemoState}
                  disabled={isSubmitting}
                  title="Clears SQLite records so all satellites revert to UNREGISTERED with 0.00 ETH"
                  style={{
                    height: '44px',
                    padding: '0 12px',
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    borderRadius: 0,
                    background: 'rgba(244, 63, 94, 0.1)',
                    color: '#fb7185',
                    fontSize: '11px',
                    fontFamily: '"Space Mono", monospace, ui-monospace',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.22)';
                      e.currentTarget.style.borderColor = '#f43f5e';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(244, 63, 94, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.45)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <RotateCcw size={13} />
                  <span>RESET DEMO STATE</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* ===================================================================
            FOOTER TELEMETRY RAIL (Continuous technical data bar)
        =================================================================== */}
        <footer
          style={{
            position: 'relative',
            minHeight: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            padding: '0 54px',
            borderTop: '1px solid rgba(6, 182, 212, 0.14)',
            background: 'rgba(0, 0, 0, 0.35)',
            ...monoTextStyle,
            color: '#64748b',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
        >
          <span>KESSLERGRID // FULL-SCREEN SPACECRAFT COMMAND HUD v3.5</span>
          <span>SYS // EVM_RPC: http://127.0.0.1:8545 // EXPRESS_PORT: 5000</span>
          <span style={{ color: '#34d399' }}>ALL PROTOCOLS NOMINAL</span>
        </footer>
      </motion.aside>

      {/* ===================================================================
          AEROSPACE HUD NOTIFICATION MODAL
      =================================================================== */}
      {hudNotice && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setHudNotice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10010,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(540px, 94vw)',
              background: 'rgba(6, 11, 25, 0.96)',
              border: `1px solid ${
                hudNotice.type === 'SUCCESS'
                  ? '#34d399'
                  : hudNotice.type === 'WARNING'
                  ? '#f43f5e'
                  : '#38bdf8'
              }`,
              boxShadow: `0 0 40px ${
                hudNotice.type === 'SUCCESS'
                  ? 'rgba(52, 211, 153, 0.2)'
                  : hudNotice.type === 'WARNING'
                  ? 'rgba(244, 63, 94, 0.2)'
                  : 'rgba(56, 189, 248, 0.2)'
              }, inset 0 0 20px rgba(0, 0, 0, 0.8)`,
              clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
              padding: '28px',
              fontFamily: '"Space Mono", monospace',
              color: '#f8fafc',
            }}
          >
            {/* Top Badge Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background:
                      hudNotice.type === 'SUCCESS'
                        ? '#34d399'
                        : hudNotice.type === 'WARNING'
                        ? '#f43f5e'
                        : '#38bdf8',
                    boxShadow: `0 0 10px ${
                      hudNotice.type === 'SUCCESS'
                        ? '#34d399'
                        : hudNotice.type === 'WARNING'
                        ? '#f43f5e'
                        : '#38bdf8'
                    }`,
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    color:
                      hudNotice.type === 'SUCCESS'
                        ? '#34d399'
                        : hudNotice.type === 'WARNING'
                        ? '#f43f5e'
                        : '#38bdf8',
                    fontWeight: 700,
                  }}
                >
                  [ MISSION TELEMETRY // NOTIFICATION ]
                </span>
              </div>
              <button
                onClick={() => setHudNotice(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Notice Title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              {hudNotice.type === 'SUCCESS' && <CheckCircle2 size={22} color="#34d399" />}
              {hudNotice.type === 'WARNING' && <AlertTriangle size={22} color="#f43f5e" />}
              {hudNotice.type === 'INFO' && <Activity size={22} color="#38bdf8" />}
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#f8fafc',
                }}
              >
                {hudNotice.title}
              </h3>
            </div>

            {/* Notice Message Content */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px',
                borderRadius: '4px',
                marginBottom: '24px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#cbd5e1',
                wordBreak: 'break-word',
              }}
            >
              {hudNotice.message}
            </div>

            {/* Actions / Dismiss Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setHudNotice(null)}
                style={{
                  background:
                    hudNotice.type === 'SUCCESS'
                      ? 'rgba(52, 211, 153, 0.15)'
                      : hudNotice.type === 'WARNING'
                      ? 'rgba(244, 63, 94, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)',
                  border: `1px solid ${
                    hudNotice.type === 'SUCCESS'
                      ? '#34d399'
                      : hudNotice.type === 'WARNING'
                      ? '#f43f5e'
                      : '#38bdf8'
                  }`,
                  color:
                    hudNotice.type === 'SUCCESS'
                      ? '#34d399'
                      : hudNotice.type === 'WARNING'
                      ? '#f43f5e'
                      : '#38bdf8',
                  padding: '10px 22px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  fontFamily: '"Space Mono", monospace',
                  transition: 'all 0.15s ease',
                  clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.25)';
                  e.currentTarget.style.boxShadow = `0 0 16px ${
                    hudNotice.type === 'SUCCESS'
                      ? 'rgba(52, 211, 153, 0.4)'
                      : hudNotice.type === 'WARNING'
                      ? 'rgba(244, 63, 94, 0.4)'
                      : 'rgba(56, 189, 248, 0.4)'
                  }`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                [ ACKNOWLEDGE // DISMISS ]
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { scrollbar-width: thin; }
        select option { font-family: "Space Mono", monospace; }
        input::placeholder { color: #475569; }
        button:disabled { opacity: 0.6; }
      `}</style>
    </>
  );
}
