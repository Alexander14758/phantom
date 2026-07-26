import { useCallback, useEffect, useRef, useState } from 'react';
import colors from '@/lib/colors';
import { formatChange, formatChangePct, formatCurrency } from '@/lib/format';
import { usePortfolio, type PortfolioToken } from '@/hooks/usePortfolio';
import { useProfile } from '@/hooks/useProfile';
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

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SwapIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <polyline points="17 1 21 5 17 9" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="7 23 3 19 7 15" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ReceiveIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke={colors.primary} strokeWidth={1.8}/>
    <rect x="14" y="3" width="7" height="7" rx="1" stroke={colors.primary} strokeWidth={1.8}/>
    <rect x="14" y="14" width="7" height="7" rx="1" stroke={colors.primary} strokeWidth={1.8}/>
    <rect x="3" y="14" width="7" height="7" rx="1" stroke={colors.primary} strokeWidth={1.8}/>
    <rect x="5" y="5" width="3" height="3" rx="0.5" fill={colors.primary}/>
    <rect x="16" y="5" width="3" height="3" rx="0.5" fill={colors.primary}/>
    <rect x="16" y="16" width="3" height="3" rx="0.5" fill={colors.primary}/>
  </svg>
);

const BuyIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <line x1="12" y1="1" x2="12" y2="23" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={colors.foreground} strokeWidth={1.8}/>
    <polyline points="12 6 12 12 16 14" stroke={colors.foreground} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke={colors.foreground} strokeWidth={1.8}/>
    <line x1="21" y1="21" x2="16.65" y2="16.65" stroke={colors.foreground} strokeWidth={1.8} strokeLinecap="round"/>
  </svg>
);

// ─── Action button ─────────────────────────────────────────────────────────────
function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
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
function TabIcon({ name, active }: { name: string; active: boolean }) {
  const c = active ? colors.tabActive : colors.tabInactive;
  const w = 1.8;
  if (name === 'Home') return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth={w} strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.15 : 0}/>
      <polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth={w} strokeLinejoin="round"/>
    </svg>
  );
  if (name === 'Activity') return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={c} strokeWidth={w}/>
      <line x1="8" y1="8" x2="16" y2="8" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <line x1="8" y1="16" x2="12" y2="16" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </svg>
  );
  if (name === 'Swap') return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <polyline points="17 1 21 5 17 9" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <polyline points="7 23 3 19 7 15" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </svg>
  );
  if (name === 'Messages') return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={c} strokeWidth={w} strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.15 : 0}/>
    </svg>
  );
  // Profile
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={w} strokeLinecap="round"/>
      <circle cx="12" cy="7" r="4" stroke={c} strokeWidth={w}/>
    </svg>
  );
}

function BottomTabBar() {
  const tabs = ['Home', 'Activity', 'Swap', 'Messages', 'Profile'];
  return (
    <div
      style={{
        display: 'flex',
        background: colors.tabBar,
        borderTop: `1px solid ${colors.tabBarBorder}`,
        paddingTop: 10,
        paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
      }}
    >
      {tabs.map((name, i) => (
        <button
          key={name}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '4px 0',
            color: i === 0 ? colors.tabActive : colors.tabInactive,
          }}
        >
          <TabIcon name={name} active={i === 0} />
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
    await portfolio.refetch();
  }, [portfolio]);

  const totalChange24h = portfolio.totalChange24h;
  const totalPct = portfolio.totalValue > 0 ? (totalChange24h / (portfolio.totalValue - totalChange24h)) * 100 : 0;
  const changeColor = totalChange24h >= 0 ? colors.green : colors.destructive;
  const changeBgColor = totalChange24h >= 0 ? '#1A3A26' : '#3A1A1A';

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
            <button
              onClick={handleRefresh}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
            >
              <ClockIcon />
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}>
              <SearchIcon />
            </button>
          </div>
        </div>

        {/* ── Balance section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 18px' }}>
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
          <ActionButton icon={<SendIcon />} label="Send" />
          <ActionButton icon={<SwapIcon />} label="Swap" />
          <ActionButton icon={<ReceiveIcon />} label="Receive" />
          <ActionButton icon={<BuyIcon />} label="Buy" />
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
        customTokens={portfolio.customTokens}
        onAddCustomToken={portfolio.addCustomToken}
        onDeleteCustomToken={portfolio.deleteCustomToken}
        onUpdateCustomToken={portfolio.updateCustomToken}
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
