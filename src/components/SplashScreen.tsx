import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SplashScreenProps {
  onComplete?: () => void;
  durationMs?: number;
}

const TERMINAL_LOGS = [
  '> KESSLERGRID STM KERNEL v3.5... [OK]',
  '> SYNCING HARDHAT RPC (31337)... [OK]',
  '> TELEMETRY INGESTION STREAM... [MOUNTED]',
  '> INITIALIZING ORBITAL ENGINE...',
];

export function SplashScreen({ onComplete, durationMs = 2600 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [logIndex, setLogIndex] = useState<number>(0);

  // Progressive terminal log display in bottom-left corner
  useEffect(() => {
    if (logIndex < TERMINAL_LOGS.length) {
      const timer = setTimeout(() => {
        setLogIndex((prev) => prev + 1);
      }, 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [logIndex]);

  // Trigger fly-through exit animation when duration completes
  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, durationMs);

    return () => clearTimeout(exitTimer);
  }, [durationMs, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="kesslergrid-flythrough-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#000000', // Pure black canvas for screen blend
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {/* Subtle Ambient Vignette & Cosmic Glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.12) 0%, rgba(0, 0, 0, 0.95) 75%)',
              pointerEvents: 'none',
            }}
          />

          {/* Holographic Borderless Logo with Cinematic Fly-Through Exit */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: [0, 1, 0.8, 1], // CRT ignition flicker
              scale: 1,
              transition: { duration: 0.45, ease: 'easeOut' },
            }}
            exit={{
              scale: 4.5, // Aggressive fly-through scale towards camera
              opacity: 0,
              filter: 'blur(12px)',
              transition: { duration: 0.8, ease: 'easeIn' },
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90%',
              maxWidth: '720px',
              zIndex: 10,
              transformOrigin: 'center center',
            }}
          >
            <img
              src="/textures/kg-logo.jpeg"
              alt="KesslerGrid Logo"
              style={{
                width: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                display: 'block',
                mixBlendMode: 'screen', // Drops out JPEG dark background into floating metallic hologram
                maskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 35%, transparent 72%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 35%, transparent 72%)',
                filter: 'contrast(1.2) brightness(1.05)',
                userSelect: 'none',
              }}
            />
          </motion.div>

          {/* Monospace Tech Terminal Feed in Bottom-Left Corner */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '40px',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontFamily: '"Space Mono", monospace',
              fontSize: '11px',
              color: '#38bdf8',
              letterSpacing: '1px',
              textShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
              userSelect: 'none',
            }}
          >
            {TERMINAL_LOGS.slice(0, logIndex).map((log, idx) => (
              <div
                key={`splash-log-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: log.includes('[OK]') ? '#34d399' : '#38bdf8',
                }}
              >
                <span>{log}</span>
                {idx === logIndex - 1 && logIndex < TERMINAL_LOGS.length && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '12px',
                      backgroundColor: '#38bdf8',
                      animation: 'pulse 0.6s infinite',
                    }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SplashScreen;
