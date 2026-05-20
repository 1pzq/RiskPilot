const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0.00';
  }

  return usdFormatter.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.0%';
  }

  return percentFormatter.format(value / 100);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return compactFormatter.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return numberFormatter.format(value);
}

export function formatAddress(address: string): string {
  if (!address || address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatRiskLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (value: number) => `${value}`.padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDatetimeLocalValue(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return date.toISOString();
}

