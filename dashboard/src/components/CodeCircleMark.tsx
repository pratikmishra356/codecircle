/**
 * CodeCircle mark: central circle (platform) with orbiting dots (tools/planets).
 * Simple, distinctive, works at any size.
 */
export function CodeCircleMark({ size = 40, showRing = true }: { size?: number; showRing?: boolean }) {
  const r = size / 2;
  const center = r;
  const orbitR = r * 0.65;
  const dotR = size * 0.12;
  const dotPositions = [0, 90, 180, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: center + orbitR * Math.cos(rad), y: center + orbitR * Math.sin(rad) };
  });
  const planetColors = ['#0d9488', '#8b5cf6', '#f59e0b', '#06b6d4'];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      {showRing && (
        <circle
          cx={center}
          cy={center}
          r={orbitR + 4}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
      )}
      <circle
        cx={center}
        cy={center}
        r={r * 0.28}
        fill="currentColor"
        opacity="0.9"
      />
      {dotPositions.map((pos, i) => (
        <circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r={dotR}
          fill={planetColors[i]}
          opacity="0.95"
        />
      ))}
    </svg>
  );
}

/**
 * Hero orbit: fixed, very spread, light background — stays put while page scrolls.
 */
export function HeroOrbit({ className = '' }: { className?: string }) {
  const ringOpacity = 0.1;
  const centerOpacity = 0.18;
  const planetOpacity = 0.22;
  const planetStrokeOpacity = 0.12;
  const planetColors = [
    '#a8e6e0',
    '#d4c8e0',
    '#fce8c8',
    '#b8e4ee',
  ];
  return (
    <div
      className={`fixed top-14 inset-x-0 bottom-0 flex items-center justify-center pointer-events-none z-0 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 200 200"
        className="w-[min(160vmax,1400px)] h-[min(160vmax,1400px)] opacity-75"
        style={{ color: 'var(--cc-border)' }}
      >
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1" opacity={ringOpacity} />
        <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="1" opacity={ringOpacity * 0.9} />
        <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="1" opacity={ringOpacity * 0.8} />
        <circle cx="100" cy="100" r="24" fill="var(--cc-accent)" opacity={centerOpacity * 0.6} />
        <circle cx="100" cy="100" r="14" fill="var(--cc-accent)" opacity={centerOpacity} />
        {[
          { angle: 0 },
          { angle: 90 },
          { angle: 180 },
          { angle: 270 },
        ].map(({ angle }, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = 100 + 56 * Math.cos(rad);
          const y = 100 + 56 * Math.sin(rad);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="12" fill={planetColors[i]} opacity={planetOpacity} />
              <circle cx={x} cy={y} r="12" fill="none" stroke="white" strokeWidth="2" opacity={planetStrokeOpacity} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
