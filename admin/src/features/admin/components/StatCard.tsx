interface StatCardProps {
  title: string;
  value: string;
  tone: 'blue' | 'green' | 'purple' | 'rose';
}

/** Displays a dashboard metric in the admin summary grid. */
export function StatCard({ title, value, tone }: StatCardProps) {
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>Updated from current admin data</small>
    </article>
  );
}
