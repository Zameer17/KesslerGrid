import { useEffect, useRef, useState } from 'react';
import { useSolarStore } from '../store/useSolarStore';

const SPEED_STEPS = [
  -63072000, // -2 YRS/S
  -31536000, // -1 YR/S
  -2592000,  // -1 MTH/S
  -604800,   // -7 DAYS/S
  -259200,   // -3 DAYS/S
  -86400,    // -1 DAY/S
  -3600,     // -1 HR/S
  -60,       // -1 MIN/S
  -10,       // -10 SECS/S
  -1,        // -1 SEC/S
  1,         // REAL RATE (1)
  10,        // 10 SECS/S
  20,        // 20 SECS/S
  60,        // 1 MIN/S
  3600,      // 1 HR/S
  86400,     // 1 DAY/S
  259200,    // 3 DAYS/S
  604800,    // 7 DAYS/S
  2592000,   // 1 MTH/S
  31536000,  // 1 YR/S
  63072000,  // 2 YRS/S
];

const SPEED_LABELS = [
  '-2 YRS/S',
  '-1 YR/S',
  '-1 MTH/S',
  '-7 DAYS/S',
  '-3 DAYS/S',
  '-1 DAY/S',
  '-1 HR/S',
  '-1 MIN/S',
  '-10 SECS/S',
  '-1 SEC/S',
  'REAL RATE',
  '10 SECS/S',
  '20 SECS/S',
  '1 MIN/S',
  '1 HR/S',
  '1 DAY/S',
  '3 DAYS/S',
  '7 DAYS/S',
  '1 MTH/S',
  '1 YR/S',
  '2 YRS/S',
];

function formatSimDateOnly(date: Date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

function formatSimTimeOnly(date: Date) {
  let hours = date.getUTCHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(date.getUTCMinutes()).padStart(2, '0');
  const sStr = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hStr}:${mStr}:${sStr} ${ampm}`;
}

export function NASATimeController() {
  const isPlaying = useSolarStore((state) => state.isPlaying);
  const timeSpeed = useSolarStore((state) => state.timeSpeed);

  const setIsPlaying = useSolarStore((state) => state.setIsPlaying);
  const setTimeSpeed = useSolarStore((state) => state.setTimeSpeed);

  const dateRef = useRef<HTMLDivElement>(null!);
  const timeRef = useRef<HTMLDivElement>(null!);
  const [controlsHovered, setControlsHovered] = useState(false);

  // Synchronize dynamic time updates via requestAnimationFrame at 60 FPS
  useEffect(() => {
    let active = true;

    function update() {
      if (!active) return;
      const state = useSolarStore.getState();

      if (dateRef.current) {
        dateRef.current.innerText = formatSimDateOnly(state.simDate);
      }
      if (timeRef.current) {
        timeRef.current.innerText = formatSimTimeOnly(state.simDate);
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => {
      active = false;
    };
  }, []);

  // Find active speed index in SPEED_STEPS
  const speedIndex = (() => {
    const idx = SPEED_STEPS.indexOf(timeSpeed);
    return idx !== -1 ? idx : 10; // Default to REAL RATE (index 10)
  })();

  const handleSliderChange = (val: number) => {
    const idx = Math.min(Math.max(0, val), SPEED_STEPS.length - 1);
    setTimeSpeed(SPEED_STEPS[idx]);
    setIsPlaying(true);
  };

  const handleStepDown = () => {
    const idx = Math.max(0, speedIndex - 1);
    setTimeSpeed(SPEED_STEPS[idx]);
    setIsPlaying(true);
  };

  const handleStepUp = () => {
    const idx = Math.min(SPEED_STEPS.length - 1, speedIndex + 1);
    setTimeSpeed(SPEED_STEPS[idx]);
    setIsPlaying(true);
  };

  const getRateColor = () => {
    if (!isPlaying) return '#ff9a42'; // Amber for PAUSED
    if (timeSpeed === 1) return '#ffffff'; // White for REAL RATE
    return '#47da84'; // Green for customized forward/reverse rates
  };

  const getRateText = () => {
    if (!isPlaying) return 'PAUSED';
    return SPEED_LABELS[speedIndex];
  };

  const t = speedIndex / (SPEED_STEPS.length - 1);
  const handleX = 560 * t;
  const handleY = 15 + 130 * t * (1 - t);

  return (
    <div
      onMouseEnter={() => setControlsHovered(true)}
      onMouseLeave={() => setControlsHovered(false)}
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        height: '120px',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        fontFamily: '"Inter", -apple-system, sans-serif',
      }}
    >
      {/* Hover Step Controls */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '14px',
          opacity: controlsHovered ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: controlsHovered ? 'auto' : 'none',
          zIndex: 15,
        }}
      >
        <button
          onClick={handleStepDown}
          style={{
            background: 'rgba(30, 30, 30, 0.75)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '9px',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)')}
        >
          &lt;&lt;
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            background: 'rgba(30, 30, 30, 0.75)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${isPlaying ? '#47da84aa' : '#d55033aa'}`,
            color: isPlaying ? '#47da84' : '#d55033',
            fontSize: '9px',
            padding: '4px 14px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <button
          onClick={handleStepUp}
          style={{
            background: 'rgba(30, 30, 30, 0.75)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '9px',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)')}
        >
          &gt;&gt;
        </button>
      </div>

      {/* Center Dynamic Rate Readout */}
      <div
        style={{
          position: 'absolute',
          top: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          fontWeight: 'bold',
          letterSpacing: '2px',
          color: getRateColor(),
          textShadow: `0 0 8px ${getRateColor()}55`,
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        {getRateText()}
      </div>

      {/* SVG Arc track and slider handle */}
      <div
        style={{
          position: 'relative',
          width: '560px',
          height: '60px',
          pointerEvents: 'none',
        }}
      >
        <svg width="560" height="60" style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Background Arc */}
          <path
            d="M 0,15 Q 280,80 560,15"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Active Highlight Arc */}
          <path
            d="M 0,15 Q 280,80 560,15"
            fill="none"
            stroke="#47da84"
            strokeWidth="2"
            strokeDasharray="560"
            strokeDashoffset={560 - 560 * t}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.15s ease' }}
          />
        </svg>

        {/* Glowing Interactive Handle with Double-Ring and Green Dot */}
        <div
          style={{
            position: 'absolute',
            left: `${handleX}px`,
            top: `${handleY}px`,
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: 'rgba(10, 15, 30, 0.85)',
            border: '1.5px solid rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px rgba(71,218,132,0.4)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Concentric Double Ring */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '1px solid #47da84',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Center Green Dot */}
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#47da84',
                boxShadow: '0 0 4px #47da84',
              }}
            />
          </div>
        </div>

        {/* Range input slider */}
        <input
          type="range"
          min="0"
          max={SPEED_STEPS.length - 1}
          step="1"
          value={speedIndex}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            width: '560px',
            height: '40px',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        />
      </div>

      {/* Flanking Timestamp Readouts */}
      <div
        ref={dateRef}
        style={{
          position: 'absolute',
          left: '0px',
          bottom: '4px',
          width: '200px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.5)',
          letterSpacing: '1.5px',
          textAlign: 'right',
          pointerEvents: 'none',
        }}
      />

      <div
        ref={timeRef}
        style={{
          position: 'absolute',
          right: '0px',
          bottom: '4px',
          width: '200px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.75)',
          fontWeight: 'bold',
          letterSpacing: '1px',
          textAlign: 'left',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
