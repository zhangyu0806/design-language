import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  tag?: ReactNode;
}

export function Card({ tag, className = "", children, ...props }: Props) {
  return (
    <div
      className={
        "p-5 bg-[var(--color-surface)] border-[1.5px] border-[var(--color-border)] " +
        "rounded-[var(--radius-card)] shadow-[var(--shadow-sm)] " +
        "[transition:box-shadow_var(--duration-quick)_var(--ease-signature)] hover:shadow-[var(--shadow-md)] " +
        className
      }
      {...props}
    >
      {tag != null && (
        <span className="inline-block mb-3 px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] type-label">
          {tag}
        </span>
      )}
      {children}
    </div>
  );
}
