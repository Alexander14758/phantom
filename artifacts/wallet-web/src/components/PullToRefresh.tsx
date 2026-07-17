/**
 * PullToRefresh — Phantom Wallet-style
 *
 * Behaviour:
 *  1. PULL  – entire page translates down with rubber-band resistance;
 *             spinner fades in above the page as pull distance grows.
 *  2. HOLD  – on release past threshold the page snaps to a held position
 *             and the spinner begins rotating.
 *  3. LOAD  – onRefresh() fires; spinner rotates for ≥ LOAD_MS.
 *  4. DONE  – spinner fades out, then the page springs back with a bounce.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// ─── Tuning constants ──────────────────────────────────────────────────────────
const THRESHOLD    = 72;   // px pulled before refresh triggers
const HOLD_Y       = 68;   // px the page stays down while loading
const MAX_PULL     = 110;  // hard cap on rubber-band distance
const RESISTANCE   = 0.42; // pull damping (lower = more resistance)
const LOAD_MS      = 2000; // minimum spinner display time
const FADE_MS      = 300;  // spinner fade-out duration
const BOUNCE_DUR   = '520ms';
const BOUNCE_EASE  = 'cubic-bezier(0.34, 1.38, 0.64, 1)'; // overshoot spring
const SNAP_DUR     = '260ms';
const SNAP_EASE    = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

// ─── Bar spinner (12 radial bars, CSS keyframe) ────────────────────────────────
const NUM_BARS = 12;

function PhantomSpinner({ size = 36, opacity = 1 }: { size?: number; opacity?: number }) {
  const scale = size / 32;
  const barW  = 2.8  * scale;
  const barH  = 7.5  * scale;
  const r     = 9    * scale;

  return (
    <>
      <style>{`
        @keyframes ptr-spin {
          to { transform: rotate(360deg); }
        }
        .ptr-spinner {
          animation: ptr-spin 900ms steps(${NUM_BARS}, end) infinite;
          transform-origin: center center;
        }
      `}</style>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          opacity,
          transition: `opacity ${FADE_MS}ms ease`,
          flexShrink: 0,
        }}
      >
        <div
          className="ptr-spinner"
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          {Array.from({ length: NUM_BARS }).map((_, i) => {
            const angle      = (i * 360) / NUM_BARS;
            const barOpacity = Math.pow((i + 1) / NUM_BARS, 0.55);
            return (
              <div
                key={i}
                style={{
                  position        : 'absolute',
                  width           : barW,
                  height          : barH,
                  borderRadius    : barW / 2,
                  backgroundColor : '#FFFFFF',
                  opacity         : barOpacity,
                  left            : size / 2 - barW / 2,
                  top             : size / 2 - barH / 2,
                  transformOrigin : `${barW / 2}px ${barH / 2}px`,
                  transform       : `rotate(${angle}deg) translateY(${-(r + barH / 2)}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Phase machine ─────────────────────────────────────────────────────────────
type Phase = 'idle' | 'pulling' | 'loading' | 'fading' | 'returning';

interface PullToRefreshProps {
  onRefresh : () => Promise<void>;
  children  : React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [phase,         setPhase]         = useState<Phase>('idle');
  const [pullY,         setPullY]         = useState(0);
  const [spinnerOpacity, setSpinnerOpacity] = useState(0);

  // refs so touch handlers always see latest values without re-registering
  const phaseRef   = useRef<Phase>('idle');
  const startYRef  = useRef(0);
  const currentYRef = useRef(0);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const loadDoneRef = useRef(false);
  const animStarted = useRef(false);

  const setPhaseSync = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // ── CSS for the page wrapper ────────────────────────────────────────────────
  function pageStyle(): React.CSSProperties {
    switch (phaseRef.current) {
      case 'pulling':
        return {
          transform  : `translateY(${pullY}px)`,
          transition : 'none',
          willChange : 'transform',
        };
      case 'loading':
      case 'fading':
        return {
          transform  : `translateY(${HOLD_Y}px)`,
          transition : `transform ${SNAP_DUR} ${SNAP_EASE}`,
          willChange : 'transform',
        };
      case 'returning':
        return {
          transform  : 'translateY(0)',
          transition : `transform ${BOUNCE_DUR} ${BOUNCE_EASE}`,
          willChange : 'transform',
        };
      default:
        return { transform: 'translateY(0)', transition: 'none' };
    }
  }

  // ── Spinner visibility ──────────────────────────────────────────────────────
  // During pull: opacity grows with distance. During load: full. Fading: 0.
  const computedSpinnerOpacity =
    phase === 'loading'  ? 1
    : phase === 'fading' ? 0
    : phase === 'returning' || phase === 'idle' ? 0
    : Math.min(pullY / THRESHOLD, 1);

  // ── Refresh sequence ────────────────────────────────────────────────────────
  const startRefresh = useCallback(async () => {
    if (animStarted.current) return;
    animStarted.current = true;
    loadDoneRef.current = false;

    setPullY(HOLD_Y);
    setPhaseSync('loading');

    // fire both: fetch + minimum timer
    const [fetchResult] = await Promise.allSettled([
      onRefresh(),
      new Promise(res => setTimeout(res, LOAD_MS)),
    ]);

    // fade spinner out
    setPhaseSync('fading');

    // after fade, spring-bounce back
    setTimeout(() => {
      setPhaseSync('returning');
      setPullY(0);
      // reset to idle after animation
      setTimeout(() => {
        setPhaseSync('idle');
        animStarted.current = false;
      }, parseInt(BOUNCE_DUR) + 60);
    }, FADE_MS + 40);
  }, [onRefresh]);

  // ── Touch handlers (passive-safe) ──────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'idle') return;
      if (el.scrollTop > 0) return;
      startYRef.current   = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      setPhaseSync('pulling');
      setPullY(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phaseRef.current !== 'pulling') return;
      const dy = e.touches[0].clientY - startYRef.current;
      currentYRef.current = e.touches[0].clientY;

      if (dy <= 0) {
        // moved up — cancel pull
        if (el.scrollTop === 0) setPullY(0);
        else { setPhaseSync('idle'); setPullY(0); }
        return;
      }
      // prevent native scroll while pulling down
      if (el.scrollTop === 0) e.preventDefault();

      const clamped = Math.min(dy * RESISTANCE, MAX_PULL);
      setPullY(clamped);
    };

    const onTouchEnd = () => {
      if (phaseRef.current !== 'pulling') return;
      const reached = pullY >= THRESHOLD;
      if (!reached) {
        setPhaseSync('returning');
        setPullY(0);
        setTimeout(() => setPhaseSync('idle'), parseInt(SNAP_DUR) + 60);
      } else {
        startRefresh();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [pullY, startRefresh]);

  return (
    <div
      style={{
        position : 'relative',
        height   : '100%',
        overflow : 'hidden',
        display  : 'flex',
        flexDirection : 'column',
      }}
    >
      {/* ── Spinner lives above the page, revealed by translateY ── */}
      <div
        aria-hidden
        style={{
          position        : 'absolute',
          top             : 0,
          left            : 0,
          right           : 0,
          height          : HOLD_Y,
          display         : 'flex',
          alignItems      : 'center',
          justifyContent  : 'center',
          zIndex          : 0,
          pointerEvents   : 'none',
        }}
      >
        <PhantomSpinner
          size={34}
          opacity={computedSpinnerOpacity}
        />
      </div>

      {/* ── Page — translates down on pull ── */}
      <div
        ref={scrollRef}
        style={{
          flex               : 1,
          overflowY          : 'auto',
          overflowX          : 'hidden',
          position           : 'relative',
          zIndex             : 1,
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          ...pageStyle(),
        }}
      >
        {children}
      </div>
    </div>
  );
}
