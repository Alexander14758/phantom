import { useCallback, useEffect, useRef, useState } from 'react';
import colors from '@/lib/colors';
import { formatChange, formatChangePct, formatCurrency } from '@/lib/format';
import { usePortfolio, type PortfolioToken } from '@/hooks/usePortfolio';
import { useProfile } from '@/hooks/useProfile';
import { BarSpinner } from '@/components/BarSpinner';
import { TokenRow } from '@/components/TokenRow';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ProfileModal } from '@/components/ProfileModal';
import { EditTokenModal } from '@/components/EditTokenModal';

// ─── Balance counting animation ───────────────────────────────────────────────
function useCountingAnimation(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  const animateTo = useCallback((from: number, to: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (from === to) { setDisplay(to); return; }
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [duration]);

  const update = useCallback((newTarget: number) => {
    animateTo(prevRef.current, newTarget);
  }, [animateTo]);

  return { display, update };
}

// ─── Action button ─────────────────────────────────────────────────────────────
function ActionButton({ icon, label }: { icon: string; label: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <button
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          width: 60, height: 60, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: colors.card,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          transform: pressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 80ms ease',
        }}
      >
        {icon}
      </button>
      <span style={{ fontSize: 12, color: colors.mutedForeground }}>{label}</span>
    </div>
  );
}

// ─── Bottom tab bar ────────────────────────────────────────────────────────────
function BottomTabBar() {
  const tabs = [
    { icon: '⌂', label: 'Home' },
    { icon: '☰', label: 'Activity' },
    { icon: '⇄', label: 'Swap' },
    { icon: '✉', label: 'Messages' },
    { icon: '👤', label: 'Profile' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        background: colors.tabBar,
        borderTop: `1px solid ${colors.tabBarBorder}`,
        paddingTop: 10,
        paddingBottom: 18,
        flexShrink: 0,
      }}
    >
      {tabs.map((t, i) => (
        <button
          key={t.label}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '4px 0',
            color: i === 0 ? colors.tabActive : colors.tabInactive,
            fontSize: 20, lineHeight: 1,
          }}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function WalletDashboard() {
  const { profile, balances, connectedWallet, saveProfile, saveBalances, saveConnectedWallet } = useProfile();
  const portfolio = usePortfolio(balances, connectedWallet?.address);

  const [profileOpen, setProfileOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<PortfolioToken | null>(null);
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  // Live pulse animation for WS status dot
  const pulseRef = useRef<HTMLDivElement>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (portfolio.wsStatus !== 'connected') {
      if (pulseTimerRef.current) { clearInterval(pulseTimerRef.current); pulseTimerRef.current = null; }
      if (pulseRef.current) pulseRef.current.style.opacity = '1';
      return;
    }
    let up = false;
    pulseTimerRef.current = setInterval(() => {
      if (pulseRef.current) pulseRef.current.style.opacity = up ? '1' : '0.3';
      up = !up;
    }, 900);
    return () => { if (pulseTimerRef.current) clearInterval(pulseTimerRef.current); };
  }, [portfolio.wsStatus]);

  // Balance counting animation
  const { display: displayBalance, update: updateBalance } = useCountingAnimation(0);
  const prevTotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (portfolio.totalValue > 0) {
      if (prevTotalRef.current === null) {
        prevTotalRef.current = portfolio.totalValue;
        updateBalance(portfolio.totalValue);
      } else if (prevTotalRef.current !== portfolio.totalValue) {
        updateBalance(portfolio.totalValue);
        prevTotalRef.current = portfolio.totalValue;
      }
    }
  }, [portfolio.totalValue, updateBalance]);

  const handleRefresh = useCallback(async () => {
    setSpinnerVisible(true);
    await portfolio.refetch();
    await new Promise(res => setTimeout(res, 400));
    setSpinnerVisible(false);
  }, [portfolio]);

  const totalChange24h = portfolio.totalChange24h;
  const totalPct = portfolio.totalValue > 0 ? (totalChange24h / (portfolio.totalValue - totalChange24h)) * 100 : 0;
  const changeColor = totalChange24h >= 0 ? colors.green : colors.destructive;
  const changeBgColor = totalChange24h >= 0 ? '#1A3A26' : '#3A1A1A';

  const dotColor =
    portfolio.wsStatus === 'connected' ? colors.green
    : portfolio.wsStatus === 'connecting' ? '#F5A623'
    : colors.mutedForeground;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: colors.background, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        maxWidth: 480, margin: '0 auto', position: 'relative',
      }}
    >
      <PullToRefresh onRefresh={handleRefresh}>
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 8px',
          }}
        >
          <button
            onClick={() => setProfileOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#5B4AE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {profile.avatar}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: colors.mutedForeground }}>{profile.username}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.foreground }}>{profile.name}</div>
            </div>
          </button>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {portfolio.wsStatus !== 'disconnected' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  ref={pulseRef}
                  style={{ width: 7, height: 7, borderRadius: 4, background: dotColor, transition: 'opacity 900ms ease' }}
                />
                {portfolio.wsStatus === 'connected' && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: dotColor }}>Live</span>
                )}
              </div>
            )}
            <button
              onClick={handleRefresh}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.foreground, fontSize: 20, lineHeight: 1 }}
            >
              🕐
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.foreground, fontSize: 20, lineHeight: 1 }}>
              🔍
            </button>
          </div>
        </div>

        {/* ── Balance section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 18px' }}>
          {/* Bar spinner (shows during manual refresh) */}
          <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <BarSpinner size={28} color="#FFFFFF" visible={spinnerVisible} />
          </div>

          <div
            style={{
              fontSize: 44, fontWeight: 700, color: colors.foreground,
              letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCurrency(displayBalance)}
          </div>

          {portfolio.pendingTx && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: colors.primary }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: colors.primary }}>Transaction detected…</span>
            </div>
          )}

          {portfolio.totalValue > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: changeColor }}>{formatChange(totalChange24h)}</span>
              <div style={{ background: changeBgColor, paddingInline: 8, paddingBlock: 3, borderRadius: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: changeColor }}>{formatChangePct(totalPct)}</span>
              </div>
            </div>
          )}

          {portfolio.pricesError && (
            <span style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>
              Live prices unavailable — tap refresh to retry
            </span>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', padding: '0 16px 20px', gap: 6 }}>
          <ActionButton icon="📤" label="Send" />
          <ActionButton icon="⇄" label="Swap" />
          <ActionButton icon="📥" label="Receive" />
          <ActionButton icon="💵" label="Buy" />
        </div>

        {/* ── Cash balance card ── */}
        <div
          style={{
            marginInline: 16, borderRadius: 16, padding: 16, marginBottom: 24,
            background: colors.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 4 }}>Cash Balance</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: colors.foreground }}>{formatCurrency(balances.cash ?? 0)}</div>
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            style={{
              background: colors.primary, border: 'none', borderRadius: 20,
              padding: '10px 18px', color: colors.primaryForeground,
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Add Cash
          </button>
        </div>

        {/* ── Token list ── */}
        {portfolio.tokens.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInline: 20, marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: colors.foreground }}>Tokens</span>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.foreground} strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
            </div>

            <div
              style={{
                marginInline: 16, borderRadius: 16, overflow: 'hidden',
                background: colors.card,
              }}
            >
              {portfolio.tokens.map((token, idx) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  isLast={idx === portfolio.tokens.length - 1}
                />
              ))}
            </div>

            {connectedWallet && portfolio.walletTokens.length > 0 && (
              <div style={{ textAlign: 'center', fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>
                {portfolio.walletTokens.length} token{portfolio.walletTokens.length !== 1 ? 's' : ''} from connected wallet
              </div>
            )}

            <button
              onClick={() => setProfileOpen(true)}
              style={{
                display: 'block', width: '100%', textAlign: 'center', padding: '20px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, color: colors.primary, fontFamily: 'inherit',
              }}
            >
              Manage token list
            </button>
          </>
        )}

        {/* Loading placeholder */}
        {portfolio.isLoading && portfolio.tokens.every(t => t.value === 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 32 }}>
            <span style={{ fontSize: 14, color: colors.mutedForeground }}>Fetching live prices…</span>
          </div>
        )}

        {/* Bottom padding for tab bar */}
        <div style={{ height: 110 }} />
      </PullToRefresh>

      {/* ── Bottom tab bar ── */}
      <BottomTabBar />

      {/* ── Modals ── */}
      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        balances={balances}
        connectedWallet={connectedWallet}
        onSaveProfile={saveProfile}
        onSaveBalances={saveBalances}
        onConnectWallet={saveConnectedWallet}
        allWalletTokens={portfolio.allWalletTokens}
        removedMints={portfolio.removedMints}
        walletDisplayLimit={portfolio.walletDisplayLimit}
        onSetWalletLimit={portfolio.setWalletLimit}
        onRemoveWalletToken={portfolio.removeToken}
        onRestoreWalletToken={portfolio.restoreToken}
        onEditToken={token => { setProfileOpen(false); setTimeout(() => setEditingToken(token), 200); }}
      />

      <EditTokenModal
        visible={editingToken !== null}
        token={editingToken}
        onClose={() => setEditingToken(null)}
        onSave={(id, balance, pnlUsd) => {
          portfolio.editToken(id, balance, pnlUsd ?? 0);
          setEditingToken(null);
        }}
      />
    </div>
  );
}
