import { useEffect, useRef } from 'react';

const NUM_BARS = 12;

interface BarSpinnerProps {
  size?: number;
  color?: string;
  visible?: boolean;
}

export function BarSpinner({ size = 32, color = '#FFFFFF', visible = true }: BarSpinnerProps) {
  const rotRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = 0;
    const step = (ts: number) => {
      const delta = ts - last;
      last = ts;
      rotRef.current = (rotRef.current + (delta / 900) * 360) % 360;
      if (containerRef.current) {
        containerRef.current.style.transform = `rotate(${rotRef.current}deg)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const scale = size / 32;
  const barW = 2.5 * scale;
  const barH = 7 * scale;
  const radius = 9 * scale;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 250ms ease',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {Array.from({ length: NUM_BARS }).map((_, i) => {
          const angle = (i * 360) / NUM_BARS;
          const barOpacity = Math.pow((i + 1) / NUM_BARS, 0.6);
          // Position bar at top-center, then rotate around center
          const x = size / 2 - barW / 2;
          const cy = size / 2;
          const ty = -(radius + barH / 2);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: barW,
                height: barH,
                borderRadius: barW / 2,
                backgroundColor: color,
                opacity: barOpacity,
                left: x,
                top: cy - barH / 2,
                transformOrigin: `${barW / 2}px ${barH / 2}px`,
                transform: `rotate(${angle}deg) translateY(${ty}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
