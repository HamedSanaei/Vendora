import type { ReactNode } from "react";
import type { OrderStatus, ReturnStatus } from "@/lib/vendora/types";

export type BadgeTone = "success" | "warning" | "info" | "purple" | "danger" | "jade";
const tones: Record<BadgeTone, string> = { jade: "bg-jade-tint text-jade", success: "bg-vd-success-tint text-vd-success", warning: "bg-vd-warning-tint text-vd-warning", info: "bg-vd-info-tint text-vd-info", purple: "bg-vd-purple-tint text-vd-purple", danger: "bg-vd-danger-tint text-vd-danger" };
const orderTones: Record<OrderStatus, BadgeTone> = { awaiting_payment: "warning", processing: "warning", shipped: "purple", delivered: "success", cancelled: "danger" };
const returnTones: Record<ReturnStatus, BadgeTone> = { under_review: "warning", approved: "success", rejected: "danger" };

/** Penpot 28px pill badge used for commerce and account states. */
export function StatusBadge({ tone = "jade", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex h-7 min-w-max items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-semibold leading-none ${tones[tone]} ${className}`}>{children}</span>;
}
export function OrderStatusBadge({ status, labels, className }: { status: OrderStatus; labels: Record<string, string>; className?: string }) { return <StatusBadge tone={orderTones[status]} className={className}>{labels[status] ?? status}</StatusBadge>; }
export function ReturnStatusBadge({ status, labels }: { status: ReturnStatus; labels: Record<string, string> }) { return <StatusBadge tone={returnTones[status]}>{labels[status] ?? status}</StatusBadge>; }
