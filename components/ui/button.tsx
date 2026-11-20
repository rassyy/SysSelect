import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex h-9 items-center justify-center gap-2 rounded-input px-3.5 " +
  "text-[13.5px] font-medium transition-colors duration-150 " +
  "focus-ring disabled:cursor-not-allowed select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-surface hover:bg-[#2a2723] disabled:bg-track disabled:text-ink-3 disabled:border disabled:border-hairline",
  secondary:
    "bg-surface text-ink border border-hairline-2 hover:bg-surface-2 disabled:bg-track disabled:text-ink-3 disabled:border-hairline",
  ghost:
    "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink disabled:bg-track disabled:text-ink-3",
};

export function buttonVariants({
  variant = "primary",
  className,
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return cn(base, variants[variant], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Wajib diisi saat disabled: tooltip alasan (DESIGN.md 4.2). */
  disabledReason?: string;
}

export function Button({
  variant = "primary",
  className,
  disabled,
  disabledReason,
  title,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : title}
      aria-disabled={disabled || undefined}
      {...props}
    />
  );
}
