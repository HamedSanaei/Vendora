import Link from "next/link";
import { ArrowEndIcon } from "@/components/vendora/icons";

export interface SectionHeadingProps {
  title: string;
  mobileTitle?: string;
  linkLabel?: string;
  linkHref?: string;
  headingId?: string;
  compact?: boolean;
}

/** Penpot 720×56 section heading; compact preserves the verified Home frame rhythm. */
export function SectionHeading({ title, mobileTitle, linkLabel, linkHref, headingId, compact = false }: SectionHeadingProps) {
  const height = compact ? "h-[42px] md:h-11 lg:h-12" : "h-[42px] md:h-11 lg:h-14";
  return (
    <div className={`flex items-center justify-between gap-4 ${height}`}>
      <h2 id={headingId} className={`flex items-center text-2xl font-bold leading-[1.4] text-ink ${height}`}>
        {mobileTitle ? <><span className="lg:hidden">{mobileTitle}</span><span className="hidden lg:inline">{title}</span></> : title}
      </h2>
      {linkLabel && linkHref ? <Link href={linkHref} className={`vd-focus group inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-jade hover:text-jade-dark lg:w-[180px] lg:text-sm ${height}`}>{linkLabel}<ArrowEndIcon size={16} className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></Link> : null}
    </div>
  );
}
