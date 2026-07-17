import { useState } from 'react';
import colors from '@/lib/colors';
import { formatAmount, formatChange, formatCurrency } from '@/lib/format';
import type { PortfolioToken } from '@/hooks/usePortfolio';

interface TokenRowProps {
  token: PortfolioToken;
  isLast: boolean;
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
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.secondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.foreground }}>
                {token.symbol.slice(0, 2)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: colors.foreground,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
              }}
            >
              {token.name}
            </span>
            {token.verified && (
              /* Ionicons checkmark-circle filled — same as mobile app */
              <svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill={colors.primary}
                style={{ flexShrink: 0 }}
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z" />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: 13,
              color: colors.mutedForeground,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              marginTop: 3,
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

      {/* Divider — opaque wrapper so card bg hides any behind-the-scenes color at left */}
      {!isLast && (
        <div style={{ backgroundColor: colors.card }}>
          <div
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 72,
            }}
          />
        </div>
      )}
    </>
  );
}
