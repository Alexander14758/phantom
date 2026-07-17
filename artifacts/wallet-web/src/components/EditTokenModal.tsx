import { useEffect, useRef, useState } from 'react';
import colors from '@/lib/colors';
import type { PortfolioToken } from '@/hooks/usePortfolio';

interface Props {
  visible: boolean;
  token: PortfolioToken | null;
  onClose: () => void;
  onSave: (id: string, balance: number, pnlUsd: number | null) => void;
}

export function EditTokenModal({ visible, token, onClose, onSave }: Props) {
  const [balance, setBalance] = useState('');
  const [pnlAmount, setPnlAmount] = useState('');
  const [pnlDir, setPnlDir] = useState<'profit' | 'loss'>('profit');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    setBalance(
      token.amount < 0.0001
        ? token.amount.toFixed(8)
        : token.amount <= 1
        ? token.amount.toFixed(6)
        : token.amount.toFixed(4)
    );
    const existingPnl = token.pnlUsdOverride;
    if (existingPnl !== undefined) {
      setPnlAmount(Math.abs(existingPnl).toFixed(2));
      setPnlDir(existingPnl >= 0 ? 'profit' : 'loss');
    } else {
      const rawPct = token.change24h ?? 0;
      const rawUsd = token.value > 0 ? Math.abs(token.value - token.value / (1 + rawPct / 100)) : 0;
      setPnlAmount(rawUsd.toFixed(2));
      setPnlDir(rawPct >= 0 ? 'profit' : 'loss');
    }
  }, [token]);

  if (!token) return null;

  const numBalance = parseFloat(balance.replace(/,/g, '')) || 0;
  const usdValue = numBalance * token.price;
  const pnlUsdSigned = (parseFloat(pnlAmount.replace(/,/g, '')) || 0) * (pnlDir === 'profit' ? 1 : -1);

  const handleSave = () => {
    const pnl = parseFloat(pnlAmount.replace(/,/g, ''));
    onSave(token.id, numBalance, isNaN(pnl) ? null : pnl * (pnlDir === 'profit' ? 1 : -1));
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 14,
    border: `1.5px solid ${colors.border}`,
    background: colors.background,
    color: colors.foreground,
    padding: '14px 16px',
    fontSize: 17,
    fontFamily: 'inherit',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          zIndex: 200, opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        {/* Card — slide up */}
        <div
          ref={cardRef}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            background: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: '12px 24px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 320ms cubic-bezier(.25,.46,.45,.94)',
            maxWidth: 480,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Handle bar */}
          <div style={{ width: 40, height: 4, borderRadius: 2, background: colors.border, alignSelf: 'center', marginBottom: 4 }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.foreground }}>Edit {token.name}</div>
              <div style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                {token.symbol} · {token.isWallet ? 'wallet token' : 'manual holding'}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.mutedForeground, fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>

          {/* Balance field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: colors.mutedForeground }}>
              Balance ({token.symbol})
            </label>
            <input
              style={inputStyle}
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* USD value */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.background, borderRadius: 12, padding: '14px 16px' }}>
            <span style={{ fontSize: 13, color: colors.mutedForeground }}>USD Value</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: colors.foreground }}>
              {usdValue > 0 ? '$' + usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </span>
          </div>

          {/* P&L section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: colors.mutedForeground }}>Profit / Loss (USD)</label>

            {/* Direction toggle */}
            <div style={{ display: 'flex', gap: 10 }}>
              {(['profit', 'loss'] as const).map(dir => (
                <button
                  key={dir}
                  onClick={() => setPnlDir(dir)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                    fontSize: 14, fontFamily: 'inherit', transition: 'all 150ms',
                    border: `1.5px solid ${dir === pnlDir ? (dir === 'profit' ? colors.green : colors.destructive) : colors.border}`,
                    background: dir === pnlDir
                      ? (dir === 'profit' ? colors.green + '18' : colors.destructive + '18')
                      : colors.background,
                    color: dir === pnlDir
                      ? (dir === 'profit' ? colors.green : colors.destructive)
                      : colors.mutedForeground,
                  }}
                >
                  {dir === 'profit' ? '▲ Profit' : '▼ Loss'}
                </button>
              ))}
            </div>

            <input
              style={{
                ...inputStyle,
                color: pnlDir === 'profit' ? colors.green : colors.destructive,
                borderColor: (pnlDir === 'profit' ? colors.green : colors.destructive) + '66',
              }}
              type="number"
              value={pnlAmount}
              onChange={e => setPnlAmount(e.target.value)}
              placeholder="0.00"
            />

            {/* Preview badge */}
            {parseFloat(pnlAmount) > 0 && (
              <div style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 8, background: pnlDir === 'profit' ? '#1A3A26' : '#3A1A1A' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: pnlDir === 'profit' ? colors.green : colors.destructive }}>
                  {pnlDir === 'profit' ? '+' : '−'}${Math.abs(pnlUsdSigned).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today
                </span>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            style={{
              background: colors.primary, color: colors.primaryForeground,
              border: 'none', borderRadius: 18, padding: '16px 0',
              fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              cursor: 'pointer', width: '100%', marginTop: 4,
              transition: 'opacity 150ms',
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
