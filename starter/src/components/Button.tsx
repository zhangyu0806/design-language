import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "cta" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center font-[var(--font-body)] text-sm font-[var(--weight-medium)] " +
  "px-5 py-2 rounded-[var(--radius-button)] border-[1.5px] border-transparent cursor-pointer " +
  "[transition:transform_var(--duration-quick)_var(--ease-signature),background-color_var(--duration-instant)_var(--ease-signature),box-shadow_var(--duration-quick)_var(--ease-signature),border-color_var(--duration-instant)_var(--ease-signature)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-press)]",
  cta:
    "bg-[var(--color-cta)] text-[var(--color-cta-fg)] shadow-[var(--shadow-md)] hover:-translate-y-px hover:shadow-[var(--shadow-lg)]",
  ghost:
    "bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
