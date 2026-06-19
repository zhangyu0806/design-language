import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, className = "", id, ...props }: Props) {
  const inputId = id ?? `field-${label}`;
  return (
    <div className="grid gap-1">
      <label htmlFor={inputId} className="type-label text-[var(--color-text-muted)]">
        {label}
      </label>
      <input
        id={inputId}
        className={
          "font-[var(--font-body)] text-base text-[var(--color-text)] px-3 py-2 " +
          "bg-[var(--color-surface)] border-[1.5px] border-[var(--color-border)] rounded-[var(--radius-input)] " +
          "[transition:border-color_var(--duration-instant)_var(--ease-signature),box-shadow_var(--duration-instant)_var(--ease-signature)] " +
          "focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] " +
          className
        }
        {...props}
      />
    </div>
  );
}
