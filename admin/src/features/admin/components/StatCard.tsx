interface StatCardProps {
  subtitle?: string;
  title: string;
  value: string;
  tone: 'blue' | 'green' | 'purple' | 'rose';
}

/** Displays a real dashboard metric in the reusable Penpot summary card. */
export function StatCard({ subtitle, title, value, tone }: StatCardProps) {
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <span className="admin-stat-label">{title}</span>
      <strong>{value}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </article>
  );
}
