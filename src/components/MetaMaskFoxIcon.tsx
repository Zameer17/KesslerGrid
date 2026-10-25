import React from 'react';

export interface MetaMaskFoxIconProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
}

export function MetaMaskFoxIcon({ className = '', style, size = 20 }: MetaMaskFoxIconProps) {
  return (
    <svg
      viewBox="0 0 318.6 318.6"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" points="274.1 35.5 174.6 109.4 193 65.8" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="44.4 35.5 143.1 110.1 125.6 65.8" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="238.3 206.8 211.8 247.4 268.5 263 284.8 207.7" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="33.9 207.7 50.1 263 106.8 247.4 80.3 206.8" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="103.6 138.2 87.8 162.1 144.1 164.6 142.1 104.1" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="214.9 138.2 175.9 103.4 174.6 164.6 230.8 162.1" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="106.8 247.4 140.6 230.9 111.4 208.1" />
      <polygon fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" points="177.9 230.9 211.8 247.4 207.1 208.1" />
      <polygon fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" points="211.8 247.4 177.9 230.9 180.6 253 180.3 262.3 268.5 263" />
      <polygon fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" points="50.1 263 138.3 262.3 138 253 140.6 230.9 106.8 247.4" />
      <polygon fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" points="138.8 193.5 110.6 185.2 130.5 176.1" />
      <polygon fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" points="179.7 193.5 188 176.1 208 185.2" />
      <polygon fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" points="106.8 247.4 50.1 263 65.1 284.1 138.4 284.1 138.3 262.3" />
      <polygon fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" points="268.5 263 211.8 247.4 180.3 262.3 180.1 284.1 253.4 284.1" />
      <polygon fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" points="230.8 162.1 174.6 164.6 179.8 193.5 188.1 176.1 208.1 185.2 238.3 206.8 284.8 207.7" />
      <polygon fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" points="87.8 162.1 33.9 207.7 80.3 206.8 110.6 185.2 130.5 176.1 138.8 193.5 144.1 164.6" />
      <polygon fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" points="174.6 109.4 274.1 35.5 256.5 133.7 214.9 138.2 175.9 103.4" />
      <polygon fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" points="44.4 35.5 143.1 110.1 142.1 104.1 103.6 138.2 62.1 133.7" />
      <polygon fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" points="62.1 133.7 103.6 138.2 87.8 162.1 33.9 207.7" />
      <polygon fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" points="256.5 133.7 284.8 207.7 230.8 162.1 214.9 138.2" />
      <polygon fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" points="180.6 253 177.9 230.9 140.6 230.9 138 253 138.3 262.3 180.3 262.3" />
      <polygon fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" points="180.3 262.3 138.3 262.3 138.4 284.1 180.1 284.1" />
      <polygon fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" points="144.1 164.6 138.8 193.5 145.4 227.6 146.9 164.5" />
      <polygon fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round" points="174.6 164.6 171.7 164.5 173.2 227.6 179.8 193.5" />
      <polygon fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" points="177.9 230.9 173.2 227.6 171.7 164.5 174.6 164.6 230.8 162.1 207.1 208.1" />
      <polygon fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" points="140.6 230.9 111.4 208.1 87.8 162.1 144.1 164.6 146.9 164.5 145.4 227.6" />
    </svg>
  );
}

export interface MetaMaskWatermarkProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  opacity?: number;
}

export function MetaMaskWatermark({
  className = '',
  style,
  size = 300,
  color = '#00F0FF',
  strokeWidth = 0.5,
  opacity = 0.25,
}: MetaMaskWatermarkProps) {
  return (
    <svg
      viewBox="0 0 318.6 318.6"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity,
        filter: 'drop-shadow(0 0 15px rgba(0, 240, 255, 0.35)) drop-shadow(0 10px 10px rgba(0, 0, 0, 0.5))',
        ...style,
      }}
      xmlns="http://www.w3.org/2000/svg"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={0.85}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="fox-holo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#0369a1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="fox-holo-accent" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#0284c7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#082f49" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="fox-holo-dark" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <polygon fill="url(#fox-holo)" points="274.1 35.5 174.6 109.4 193 65.8" />
      <polygon fill="url(#fox-holo-accent)" points="44.4 35.5 143.1 110.1 125.6 65.8" />
      <polygon fill="url(#fox-holo)" points="238.3 206.8 211.8 247.4 268.5 263 284.8 207.7" />
      <polygon fill="url(#fox-holo-accent)" points="33.9 207.7 50.1 263 106.8 247.4 80.3 206.8" />
      <polygon fill="url(#fox-holo)" points="103.6 138.2 87.8 162.1 144.1 164.6 142.1 104.1" />
      <polygon fill="url(#fox-holo-accent)" points="214.9 138.2 175.9 103.4 174.6 164.6 230.8 162.1" />
      <polygon fill="url(#fox-holo)" points="106.8 247.4 140.6 230.9 111.4 208.1" />
      <polygon fill="url(#fox-holo-accent)" points="177.9 230.9 211.8 247.4 207.1 208.1" />
      <polygon fill="url(#fox-holo-dark)" points="211.8 247.4 177.9 230.9 180.6 253 180.3 262.3 268.5 263" />
      <polygon fill="url(#fox-holo-dark)" points="50.1 263 138.3 262.3 138 253 140.6 230.9 106.8 247.4" />
      <polygon fill="url(#fox-holo-accent)" points="138.8 193.5 110.6 185.2 130.5 176.1" />
      <polygon fill="url(#fox-holo)" points="179.7 193.5 188 176.1 208 185.2" />
      <polygon fill="url(#fox-holo-accent)" points="106.8 247.4 50.1 263 65.1 284.1 138.4 284.1 138.3 262.3" />
      <polygon fill="url(#fox-holo)" points="268.5 263 211.8 247.4 180.3 262.3 180.1 284.1 253.4 284.1" />
      <polygon fill="url(#fox-holo-accent)" points="230.8 162.1 174.6 164.6 179.8 193.5 188.1 176.1 208.1 185.2 238.3 206.8 284.8 207.7" />
      <polygon fill="url(#fox-holo)" points="87.8 162.1 33.9 207.7 80.3 206.8 110.6 185.2 130.5 176.1 138.8 193.5 144.1 164.6" />
      <polygon fill="url(#fox-holo-accent)" points="174.6 109.4 274.1 35.5 256.5 133.7 214.9 138.2 175.9 103.4" />
      <polygon fill="url(#fox-holo)" points="44.4 35.5 143.1 110.1 142.1 104.1 103.6 138.2 62.1 133.7" />
      <polygon fill="url(#fox-holo-accent)" points="62.1 133.7 103.6 138.2 87.8 162.1 33.9 207.7" />
      <polygon fill="url(#fox-holo)" points="256.5 133.7 284.8 207.7 230.8 162.1 214.9 138.2" />
      <polygon fill="url(#fox-holo-dark)" points="180.6 253 177.9 230.9 140.6 230.9 138 253 138.3 262.3 180.3 262.3" />
      <polygon fill="url(#fox-holo-dark)" points="180.3 262.3 138.3 262.3 138.4 284.1 180.1 284.1" />
      <polygon fill="url(#fox-holo)" points="144.1 164.6 138.8 193.5 145.4 227.6 146.9 164.5" />
      <polygon fill="url(#fox-holo-accent)" points="174.6 164.6 171.7 164.5 173.2 227.6 179.8 193.5" />
      <polygon fill="url(#fox-holo)" points="177.9 230.9 173.2 227.6 171.7 164.5 174.6 164.6 230.8 162.1 207.1 208.1" />
      <polygon fill="url(#fox-holo-accent)" points="140.6 230.9 111.4 208.1 87.8 162.1 144.1 164.6 146.9 164.5 145.4 227.6" />
    </svg>
  );
}

export default MetaMaskFoxIcon;
