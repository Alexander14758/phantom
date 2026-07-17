import { useEffect, useRef, useState } from 'react';
import colors from '@/lib/colors';
import type { Balances, ConnectedWallet, Profile } from '@/hooks/useProfile';
import type { PortfolioToken } from '@/hooks/usePortfolio';

const EMOJI_AVATARS = [
  '🔮','👾','🦊','🐉','🦁','🐺','🎭','🌙',
  '⚡','🔥','💎','🚀','🛸','🌊','🎯','🏆',
  '👑','🤖','🦋','🐬','🌈','🎪','🧿','🪐',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  balances: Balances;
  connectedWallet: ConnectedWallet | null;
  onSaveProfile: (u: Partial<Profile>) => void;
  onSaveBalances: (u: Partial<Balances>) => void;
  onConnectWallet: (w: ConnectedWallet | null) => void;
  allWalletTokens?: PortfolioToken[];
  removedMints?: Set<string>;
  walletDisplayLimit?: number;
  onSetWalletLimit?: (n: number) => void;
  onRemoveWalletToken?: (id: string) => void;
  onRestoreWalletToken?: (id: string) => void;
  onEditToken?: (token: PortfolioToken) => void;
}

const fld: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '13px 0',
};
const flbl: React.CSSProperties = {
  fontSize: 15, color: colors.mutedForeground, flex: 1,
};
const finp: React.CSSProperties = {
  flex: 1.2, textAlign: 'right', fontSize: 15, background: 'none',
  border: 'none', color: colors.foreground, fontFamily: 'inherit', outline: 'none', minWidth: 0,
};
const card: React.CSSProperties = {
  background: colors.card, borderRadius: 16, padding: 16,
  marginBottom: 16, marginLeft: 16, marginRight: 16,
};
const clbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.8px',
  color: colors.mutedForeground, marginBottom: 12, textTransform: 'uppercase',
};

export function ProfileModal({
  visible, onClose, profile, balances, connectedWallet,
  onSaveProfile, onSaveBalances, onConnectWallet,
  allWalletTokens = [], removedMints = new Set(), walletDisplayLimit = 0,
  onSetWalletLimit, onRemoveWalletToken, onRestoreWalletToken, onEditToken,
}: Props) {
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [solBal, setSolBal] = useState(String(balances.solana));
  const [btcBal, setBtcBal] = useState(String(balances.bitcoin));
  const [ethBal, setEthBal] = useState(String(balances.ethereum));
  const [cashBal, setCashBal] = useState(String(balances.cash ?? 5650));
  const [walletAddr, setWalletAddr] = useState(connectedWallet?.address ?? '');
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      setName(profile.name); setUsername(profile.username); setAvatar(profile.avatar);
      setSolBal(String(balances.solana)); setBtcBal(String(balances.bitcoin));
      setEthBal(String(balances.ethereum)); setCashBal(String(balances.cash ?? 5650));
      setWalletAddr(connectedWallet?.address ?? '');
      setConnectErr(''); setSelectedIds(new Set());
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [visible, profile, balances, connectedWallet]);

  const handleSave = () => {
    setSaving(true);
    onSaveProfile({ name: name.trim(), username: username.trim(), avatar });
    onSaveBalances({
      solana: Math.max(0, parseFloat(solBal) || 0),
      bitcoin: Math.max(0, parseFloat(btcBal) || 0),
      ethereum: Math.max(0, parseFloat(ethBal) || 0),
      cash: Math.max(0, parseFloat(cashBal) || 0),
    });
    setTimeout(() => { setSaving(false); onClose(); }, 200);
  };

  const handleConnect = () => {
    const addr = walletAddr.trim();
    if (!addr) return;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
      setConnectErr('Invalid Solana address. Please check and try again.'); return;
    }
    setConnecting(true); setConnectErr('');
    try { onConnectWallet({ address: addr }); } catch { setConnectErr('Failed to connect.'); }
    setConnecting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const removeSelected = () => {
    selectedIds.forEach(id => onRemoveWalletToken?.(id));
    setSelectedIds(new Set());
  };

  const divider = <div style={{ height: 1, background: colors.border }} />;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          opacity: visible ? 1 : 0, transition: 'opacity 250ms ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: colors.background,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(.25,.46,.45,.94)',
          maxWidth: 480, margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 20px 16px', borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.mutedForeground, fontSize: 20, lineHeight: 1 }}
          >
            ✕
          </button>
          <span style={{ fontSize: 17, fontWeight: 600, color: colors.foreground }}>Settings</span>
          <button
            onClick={handleSave} disabled={saving}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.primary, fontSize: 16, fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, paddingBottom: 48, WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>

          {/* Avatar preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0' }}>
            <div style={{ width: 84, height: 84, borderRadius: 42, background: colors.card, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 44 }}>{avatar}</span>
            </div>
            <span style={{ fontSize: 13, color: colors.mutedForeground }}>Tap an emoji to change avatar</span>
          </div>

          {/* Emoji picker */}
          <div style={card}>
            <div style={clbl}>Choose Avatar</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJI_AVATARS.map(e => (
                <button
                  key={e}
                  onClick={() => setAvatar(e)}
                  style={{
                    width: 46, height: 46, borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${avatar === e ? colors.primary : 'transparent'}`,
                    background: avatar === e ? colors.primary + '33' : 'transparent',
                    fontSize: 24, transition: 'all 120ms',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Profile info */}
          <div style={card}>
            <div style={clbl}>Profile Info</div>
            {[
              { label: 'Display Name', value: name, onChange: setName },
              { label: 'Username', value: username, onChange: setUsername },
            ].map((f, i, arr) => (
              <div key={f.label}>
                <div style={fld}>
                  <span style={flbl}>{f.label}</span>
                  <input style={finp} value={f.value} onChange={e => f.onChange(e.target.value)} />
                </div>
                {i < arr.length - 1 && divider}
              </div>
            ))}
          </div>

          {/* Wallet assets */}
          <div style={card}>
            <div style={clbl}>Wallet Assets</div>
            {[
              { label: 'Solana (SOL)', value: solBal, onChange: setSolBal },
              { label: 'Bitcoin (BTC)', value: btcBal, onChange: setBtcBal },
              { label: 'Ethereum (ETH)', value: ethBal, onChange: setEthBal },
              { label: 'Cash (USD)', value: cashBal, onChange: setCashBal },
            ].map((f, i, arr) => (
              <div key={f.label}>
                <div style={fld}>
                  <span style={flbl}>{f.label}</span>
                  <input style={finp} type="number" value={f.value} onChange={e => f.onChange(e.target.value)} />
                </div>
                {i < arr.length - 1 && divider}
              </div>
            ))}
          </div>

          {/* Connect wallet */}
          <div style={card}>
            <div style={clbl}>Connect Wallet</div>
            {connectedWallet ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.green + '18', border: `1px solid ${colors.green}40`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={2.5}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span style={{ fontSize: 13, color: colors.green, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connectedWallet.address}</span>
                </div>
                <button
                  onClick={() => { onConnectWallet(null); setWalletAddr(''); }}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, background: 'none', color: colors.mutedForeground, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  Disconnect Wallet
                </button>
              </>
            ) : (
              <>
                <input
                  value={walletAddr}
                  onChange={e => { setWalletAddr(e.target.value); setConnectErr(''); }}
                  placeholder="Paste Solana wallet address"
                  style={{
                    width: '100%', padding: 12, borderRadius: 12, boxSizing: 'border-box',
                    border: `1px solid ${connectErr ? colors.destructive : colors.border}`,
                    background: colors.secondary, color: colors.foreground,
                    fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 8,
                  }}
                />
                {connectErr && <div style={{ fontSize: 13, color: colors.destructive, marginBottom: 8 }}>{connectErr}</div>}
                <button
                  onClick={handleConnect} disabled={connecting || !walletAddr.trim()}
                  style={{
                    width: '100%', padding: 14, borderRadius: 12, border: 'none',
                    background: walletAddr.trim() ? colors.primary : colors.secondary,
                    color: walletAddr.trim() ? colors.primaryForeground : colors.mutedForeground,
                    fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    opacity: connecting ? 0.7 : 1, transition: 'all 150ms',
                  }}
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              </>
            )}
          </div>

          {/* Wallet token management */}
          {allWalletTokens.length > 0 && (
            <div style={card}>
              <div style={clbl}>Wallet Tokens</div>

              {/* Display limit */}
              <div style={{ fontSize: 15, color: colors.mutedForeground, marginBottom: 10 }}>Max tokens on dashboard</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {[0, 5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => onSetWalletLimit?.(n)}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: `1px solid ${walletDisplayLimit === n ? colors.primary : colors.border}`,
                      background: walletDisplayLimit === n ? colors.primary : colors.secondary,
                      color: walletDisplayLimit === n ? colors.primaryForeground : colors.mutedForeground,
                      fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 150ms',
                    }}
                  >
                    {n === 0 ? 'All' : n}
                  </button>
                ))}
              </div>

              {/* Token list header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 15, color: colors.mutedForeground }}>Token visibility ({allWalletTokens.length})</span>
                {selectedIds.size > 0 && (
                  <button
                    onClick={removeSelected}
                    style={{ padding: '6px 12px', borderRadius: 8, background: colors.destructive, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    Remove {selectedIds.size}
                  </button>
                )}
              </div>

              {/* Token rows */}
              <div style={{ background: colors.secondary, borderRadius: 12, overflow: 'hidden' }}>
                {allWalletTokens.map((token, idx) => {
                  const isHidden = removedMints.has(token.id);
                  const isSelected = selectedIds.has(token.id);
                  return (
                    <div key={token.id}>
                      <div
                        onClick={() => {
                          if (isHidden) { onRestoreWalletToken?.(token.id); return; }
                          toggleSelect(token.id);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', cursor: 'pointer',
                          opacity: isHidden ? 0.5 : 1, transition: 'opacity 150ms',
                        }}
                      >
                        {token.image ? (
                          <img src={token.image} alt={token.symbol} style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'contain', flexShrink: 0 }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 17, background: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: colors.foreground }}>{token.symbol.slice(0, 2)}</span>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: colors.foreground, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.name}</div>
                          <div style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>{isHidden ? 'Tap to restore' : token.symbol}</div>
                        </div>
                        {/* Edit button */}
                        {!isHidden && onEditToken && (
                          <button
                            onClick={e => { e.stopPropagation(); onEditToken(token); }}
                            style={{ background: colors.primary + '20', border: 'none', borderRadius: 8, padding: '5px 10px', color: colors.primary, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
                          >
                            Edit
                          </button>
                        )}
                        {/* Checkbox */}
                        <div
                          style={{
                            width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                            border: `1.5px solid ${isSelected ? colors.primary : colors.border}`,
                            background: isSelected ? colors.primary : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 150ms',
                          }}
                        >
                          {isHidden ? (
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : isSelected ? (
                            <svg width={11} height={11} viewBox="0 0 24 24" fill={colors.primaryForeground}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                          ) : null}
                        </div>
                      </div>
                      {idx < allWalletTokens.length - 1 && <div style={{ height: 1, background: colors.border, marginLeft: 56 }} />}
                    </div>
                  );
                })}
              </div>

              {/* Edit manual tokens (SOL/BTC/ETH) */}
              {onEditToken && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 15, color: colors.mutedForeground, marginBottom: 10 }}>Manual holdings</div>
                  <div style={{ background: colors.secondary, borderRadius: 12, overflow: 'hidden' }}>
                    {[
                      { id: 'solana', name: 'Solana', symbol: 'SOL' },
                      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
                      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
                    ].map((item, idx, arr) => (
                      <div key={item.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: colors.foreground }}>{item.name} ({item.symbol})</span>
                          <button
                            onClick={() => {
                              // Find the token in allWalletTokens or create a stub for manual ones
                              const stub: PortfolioToken = { id: item.id, name: item.name, symbol: item.symbol, image: '', amount: 0, price: 0, value: 0, change24h: 0, verified: true };
                              onEditToken(stub);
                            }}
                            style={{ background: colors.primary + '20', border: 'none', borderRadius: 8, padding: '5px 10px', color: colors.primary, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                        {idx < arr.length - 1 && <div style={{ height: 1, background: colors.border }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit tokens section (when no wallet connected) */}
          {allWalletTokens.length === 0 && onEditToken && (
            <div style={card}>
              <div style={clbl}>Manual Holdings</div>
              <div style={{ background: colors.secondary, borderRadius: 12, overflow: 'hidden' }}>
                {[
                  { id: 'solana', name: 'Solana', symbol: 'SOL' },
                  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
                  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
                ].map((item, idx, arr) => (
                  <div key={item.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: colors.foreground }}>{item.name} ({item.symbol})</span>
                      <button
                        onClick={() => {
                          const stub: PortfolioToken = { id: item.id, name: item.name, symbol: item.symbol, image: '', amount: 0, price: 0, value: 0, change24h: 0, verified: true };
                          onEditToken(stub);
                        }}
                        style={{ background: colors.primary + '20', border: 'none', borderRadius: 8, padding: '5px 10px', color: colors.primary, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </div>
                    {idx < arr.length - 1 && <div style={{ height: 1, background: colors.border }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
