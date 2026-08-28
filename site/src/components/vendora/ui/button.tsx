import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger-ghost";
export type ButtonSize = "md" | "lg";

interface SharedProps { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode; }
type NativeProps = SharedProps & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;
type LinkProps = SharedProps & { href: string } & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;
export type VendoraButtonProps = NativeProps | LinkProps;

const variants: Record<ButtonVariant, string> = {
  primary: "border border-jade bg-jade text-white hover:border-jade-dark hover:bg-jade-dark",
  outline: "border border-jade bg-white text-jade hover:bg-jade-tint",
  ghost: "border border-transparent bg-transparent text-jade hover:bg-jade-tint",
  "danger-ghost": "border border-vd-danger bg-white text-vd-danger hover:bg-vd-danger-tint",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-[13px]",
  lg: "h-12 px-4 text-sm",
};

function classes(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return `vd-focus inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold leading-none transition-colors disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${extra ?? ""}`;
}

/** Fresh implementation of the Penpot 188×48 action component with link and button semantics. */
export function VendoraButton(props: VendoraButtonProps) {
  const { variant = "primary", size = "lg", className, children } = props;
  if ("href" in props) {
    const { href, variant: _variant, size: _size, className: _className, children: _children, ...rest } = props;
    void _variant; void _size; void _className; void _children;
    return <Link href={href} className={classes(variant, size, className)} {...rest}>{children}</Link>;
  }
  const { variant: _variant, size: _size, className: _className, children: _children, ...rest } = props;
  void _variant; void _size; void _className; void _children;
  return <button className={classes(variant, size, className)} {...rest}>{children}</button>;
}
