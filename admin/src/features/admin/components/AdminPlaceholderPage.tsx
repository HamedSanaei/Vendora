interface AdminPlaceholderPageProps {
  title: string;
  description: string;
  actions?: string[];
}

/** Shows a ready admin surface for features that will receive real behavior next. */
export function AdminPlaceholderPage({ title, description, actions = [] }: AdminPlaceholderPageProps) {
  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <article className="admin-panel admin-empty-panel">
        <div>
          <h2>{title} workspace</h2>
          <p>This screen is wired into the admin panel and ready for the next implementation step.</p>
        </div>
        {actions.length > 0 ? (
          <div className="admin-action-list">
            {actions.map((action) => (
              <button className="admin-ghost-btn" type="button" key={action}>
                {action}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
