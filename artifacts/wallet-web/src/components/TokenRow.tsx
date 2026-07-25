import { useState } from 'react';
import colors from '@/lib/colors';
import { formatAmount, formatChange, formatCurrency } from '@/lib/format';
import type { PortfolioToken } from '@/hooks/usePortfolio';

interface TokenRowProps {
  token: PortfolioToken;
  isLast: boolean;
}

// Solana chain badge — matches the small logo seen on Solana-based tokens
function SolanaBadge() {
  return (
    <div
      style={{
        position: 'absolute', bottom: -1, right: -1,
        width: 17, height: 17, borderRadius: '50%',
        background: '#fff', border: '1.5px solid #1A1B23',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}
    >
      {/* Solana "S" mark — 3 diagonal stripes */}
      <svg width="11" height="9" viewBox="0 0 22 17" fill="none">
        <path d="M3.2 12.4h14.2a.5.5 0 0 1 .35.85l-2.1 2.1a.5.5 0 0 1-.35.15H1.1a.5.5 0 0 1-.35-.85l2.1-2.1a.5.5 0 0 1 .35-.15z" fill="#9945FF"/>
        <path d="M1.1 7h14.2a.5.5 0 0 1 .35.15l2.1 2.1a.5.5 0 0 1-.35.85H3.2a.5.5 0 0 1-.35-.15L.75 7.85A.5.5 0 0 1 1.1 7z" fill="#14F195"/>
        <path d="M3.2 1.5h14.2a.5.5 0 0 1 .35.85l-2.1 2.1a.5.5 0 0 1-.35.15H1.1a.5.5 0 0 1-.35-.85l2.1-2.1a.5.5 0 0 1 .35-.15z" fill="#9945FF"/>
      </svg>
    </div>
  );
}

export function TokenRow({ token, isLast }: TokenRowProps) {
  const [imgError, setImgError] = useState(false);

  const tokenChangeUsd =
    token.pnlUsdOverride !== undefined
      ? token.pnlUsdOverride
      : token.value - token.value / (1 + token.change24h / 100);
  const isPositive = tokenChangeUsd >= 0;
  const changeColor = isPositive ? colors.green : colors.destructive;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          gap: 12,
          backgroundColor: colors.card,
          cursor: 'default',
        }}
      >
        {/* Avatar */}
        <div style={{ width: 44, height: 44, flexShrink: 0, position: 'relative' }}>
          {token.image && !imgError ? (
            <img
              src={token.image}
              alt={token.symbol}
              onError={() => setImgError(true)}
              style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: colors.secondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.foreground }}>
                {token.symbol.slice(0, 2)}
              </span>
            </div>
          )}
          {/* Solana chain badge for wallet tokens */}
          {token.isWallet && <SolanaBadge />}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span
              style={{
                fontSize: 15, fontWeight: 600, color: colors.foreground,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
              }}
            >
              {token.name}
            </span>
            {token.verified && (
              <svg width={13} height={13} viewBox="0 0 24 24" fill={colors.primary} style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z" />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: 13, color: colors.mutedForeground,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'block', marginTop: 3,
            }}
          >
            {formatAmount(token.amount, token.symbol)}
          </span>
        </div>

        {/* Values */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground }}>
            {token.value > 0 ? formatCurrency(token.value) : '—'}
          </span>
          {tokenChangeUsd !== 0 && token.value > 0 && (
            <span style={{ fontSize: 13, color: changeColor }}>
              {formatChange(tokenChangeUsd)}
            </span>
          )}
        </div>
      </div>

      {!isLast && (
        <div style={{ backgroundColor: colors.card }}>
          <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 72 }} />
        </div>
      )}
    </>
  );
}
