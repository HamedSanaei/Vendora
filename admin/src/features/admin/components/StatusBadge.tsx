interface StatusBadgeProps {
  value: string;
}

/** Renders a small status pill matching the admin template table style. */
export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes('paid') || normalized.includes('verified') || normalized.includes('stock')
    ? 'success'
    : normalized.includes('pending') || normalized.includes('low')
      ? 'warning'
      : normalized.includes('cancel') || normalized.includes('out')
        ? 'danger'
        : 'info';

  return <span className={`admin-badge admin-badge-${tone}`}>{value}</span>;
}
