export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatAmount(amount: number, symbol: string): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M ' + symbol;
  if (amount >= 1_000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + symbol;
  return amount.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + symbol;
}

export function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatChangePct(pct: number): string {
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}
