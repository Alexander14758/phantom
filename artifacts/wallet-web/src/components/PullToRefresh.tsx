import { useCallback, useRef, useState } from 'react';
import { BarSpinner } from './BarSpinner';
import colors from '@/lib/colors';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 72;
const SPINNER_SHOW_MS = 2000;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || refreshingRef.current) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) {
      pullingRef.current = false;
      setPullY(0);
      return;
    }
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) { setPullY(0); return; }
    // Rubberband: resistance increases as you pull further
    const clamped = Math.min(dy * 0.45, PULL_THRESHOLD * 1.4);
    setPullY(clamped);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    const reached = pullY >= PULL_THRESHOLD;
    setPullY(0);
    if (!reached || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const [refetchResult] = await Promise.allSettled([
      onRefresh(),
      new Promise(res => setTimeout(res, SPINNER_SHOW_MS)),
    ]);
    setRefreshing(false);
    refreshingRef.current = false;
  }, [pullY, onRefresh]);

  const spinnerOpacity = refreshing ? 1 : Math.min(pullY / PULL_THRESHOLD, 1);
  const spinnerScale = refreshing ? 1 : 0.6 + (Math.min(pullY / PULL_THRESHOLD, 1) * 0.4);

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Pull indicator */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: PULL_THRESHOLD,
          opacity: spinnerOpacity,
          transform: `scale(${spinnerScale})`,
          transition: refreshing ? 'none' : 'opacity 80ms, transform 80ms',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <BarSpinner size={28} color={colors.primary} visible={true} />
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
          transition: pullY > 0 ? 'none' : 'transform 300ms cubic-bezier(.25,.46,.45,.94)',
          paddingTop: refreshing ? PULL_THRESHOLD : 0,
          transitionProperty: refreshing ? 'padding-top' : 'transform, padding-top',
        }}
      >
        {children}
      </div>
    </div>
  );
}
