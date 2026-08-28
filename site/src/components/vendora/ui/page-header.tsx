import Link from "next/link";
import { ChevronIcon } from "@/components/vendora/icons";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Direction-aware breadcrumb ("خانه / حساب کاربری / …") from the account
 * frames. Uses logical spacing and auto-flipping chevrons for RTL/LTR.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="vd-text-caption text-vd-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="vd-focus rounded-sm hover:text-jade">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-vd-muted" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronIcon size={14} className="text-vd-line" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Account page header (title + subtitle + optional primary action) from the
 * Penpot "Page Header / Default" component.
 */
export function AccountPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="text-start">
        <h1 className="vd-text-page-title text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-vd-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
