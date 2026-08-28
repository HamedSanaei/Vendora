import type { SVGProps } from "react";

/**
 * Minimal typed inline-SVG icon set for the Vendora design system.
 * Icons inherit `currentColor` and are sized via the `size` prop.
 * Directional icons are drawn neutrally and flipped with the `rtl:` Tailwind
 * variant where semantics require it.
 */
export type VendoraIconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number | undefined, props: SVGProps<SVGSVGElement>) {
  return {
    width: size ?? 20,
    height: size ?? 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function SearchIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function CartIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6.5 8h11l1.2 11.2a1.4 1.4 0 0 1-1.4 1.55H6.7a1.4 1.4 0 0 1-1.4-1.55L6.5 8Z" />
      <path d="M9 10V6.8a3 3 0 0 1 6 0V10" />
    </svg>
  );
}

export function UserIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </svg>
  );
}

export function HeartIcon({ size, filled = false, ...props }: VendoraIconProps & { filled?: boolean }) {
  return (
    <svg {...base(size, props)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.2 4.9 13a4.7 4.7 0 0 1 0-6.6 4.5 4.5 0 0 1 6.5 0l.6.6.6-.6a4.5 4.5 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6L12 20.2Z" />
    </svg>
  );
}

export function HomeIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function IdCardIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.5-1.4 1.6-2.1 3-2.1s2.5.7 3 2.1" />
      <path d="M15 9h4M15 13h4" />
    </svg>
  );
}

export function LockIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <circle cx="12" cy="15" r="1.4" />
    </svg>
  );
}

export function PinIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z" />
      <circle cx="12" cy="11" r="2.3" />
    </svg>
  );
}

export function OrdersIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

export function ReturnIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9.5 7 5 11.5 9.5 16" />
      <path d="M5 11.5h9.2A4.8 4.8 0 0 1 19 16.3V18" />
    </svg>
  );
}

export function WalletIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
      <path d="M3.5 10h17" />
      <circle cx="16.5" cy="14.3" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function QuickPayIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z" />
    </svg>
  );
}

export function StarIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)} fill="currentColor" stroke="none">
      <path d="m12 3.4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.3l-5.1 2.7 1-5.6-4.1-4 5.7-.8L12 3.4Z" />
    </svg>
  );
}

export function TruckIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}

export function QualityIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.3 2.4 2.4 5-5.2" />
    </svg>
  );
}

export function StoreIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.5 9.5 6 4.5h12l1.5 5" />
      <path d="M5 9.5a2.3 2.3 0 0 0 4.7 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.7 0" />
      <path d="M5.5 12v7.5h13V12" />
    </svg>
  );
}

export function SupportIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M5 13a7 7 0 0 1 14 0" />
      <rect x="3.5" y="12.5" width="4" height="6" rx="1.6" />
      <rect x="16.5" y="12.5" width="4" height="6" rx="1.6" />
      <path d="M19 18.5c0 1.6-1.4 2.5-3.5 2.5" />
    </svg>
  );
}

export function CloseIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Trash can used by reversible cart-line removal actions. */
export function TrashIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.5 7h15" />
      <path d="m9 7 .6-2h4.8l.6 2" />
      <path d="m6.5 7 .8 13h9.4l.8-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  );
}

export function MenuIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

/** Chevron pointing to the inline-end; flips automatically in RTL. */
export function ChevronIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)} className={`rtl:-scale-x-100 ${props.className ?? ""}`}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

/** Long arrow pointing to the inline-end; flips automatically in RTL. */
export function ArrowEndIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)} className={`rtl:-scale-x-100 ${props.className ?? ""}`}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ClockIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function WarningIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 4 21 19H3L12 4Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UploadIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 16V5" />
      <path d="m7.5 9 4.5-4.5L16.5 9" />
      <path d="M5 16.5V19h14v-2.5" />
    </svg>
  );
}

export function CreditCardIcon({ size, ...props }: VendoraIconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M6.5 14.5h4" />
    </svg>
  );
}

export function EyeIcon({ size, off = false, ...props }: VendoraIconProps & { off?: boolean }) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.6" />
      {off ? <path d="M5 5l14 14" /> : null}
    </svg>
  );
}
