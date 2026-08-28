import type { ReactNode } from "react";

/**
 * Empty state from the Penpot "Empty State / Default" component:
 * white icon circle on a soft panel, 20px bold title and 13px body.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-panel bg-surface-soft px-6 py-8 text-center ${className ?? ""}`}
    >
      <div className="flex h-[124px] w-[124px] items-center justify-center rounded-full bg-white text-jade shadow-card">
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-bold leading-7 text-ink">{title}</h3>
      <p className="vd-text-caption mt-2 max-w-md text-vd-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Full-page result state (success / failed / pending) used by the payment
 * result screens in Penpot page "Vendora · 10".
 */
export function ResultState({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "success" | "danger" | "warning";
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const ring =
    tone === "success" ? "bg-vd-success-tint text-vd-success" : tone === "danger" ? "bg-vd-danger-tint text-vd-danger" : "bg-vd-warning-tint text-vd-warning";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-14 text-center">
      <div className={`flex h-28 w-28 items-center justify-center rounded-full ${ring}`}>{icon}</div>
      <h1 className="mt-6 text-xl font-bold leading-8 text-ink md:text-2xl">{title}</h1>
      <p className="vd-text-body mt-2 text-vd-muted">{body}</p>
      {children ? <div className="mt-8 w-full">{children}</div> : null}
    </div>
  );
}
