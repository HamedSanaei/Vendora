interface StatCardProps {
  subtitle?: string;
  title: string;
  value: string;
  unit?: string;
  tone: 'blue' | 'green' | 'purple' | 'rose';
}

/** Displays a real dashboard metric in the reusable Penpot summary card. */
export function StatCard({ subtitle, title, value, unit, tone }: StatCardProps) {
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <span className="admin-stat-label">{title}</span>
      <strong><span className="admin-stat-value">{value}</span>{unit ? <> <span className="admin-stat-unit">{unit}</span></> : null}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </article>
  );
}
