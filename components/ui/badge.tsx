import * as React from "react";
import { cn } from "@/lib/utils";

export type DmRole = "cto" | "headit" | "finance";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "secondary" | "winner";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-surface-2 text-ink-2 border border-hairline",
    outline: "bg-transparent text-ink-2 border border-hairline-2",
    secondary: "bg-track text-ink-3",
    winner: "bg-ink text-surface font-bold text-[9.5px] uppercase tracking-wider",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/** Badge rank DM: 19x19px, radius 5px, mono 10.5px 700 (DESIGN.md 4.3) */
export interface DmRankBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: DmRole;
  rank: number | string;
}

export function DmRankBadge({
  role,
  rank,
  className,
  ...props
}: DmRankBadgeProps) {
  const roleStyles: Record<DmRole, string> = {
    cto: "bg-tint-cto text-dm-cto",
    headit: "bg-tint-headit text-dm-headit",
    finance: "bg-tint-finance text-dm-finance",
  };

  return (
    <span
      className={cn(
        "inline-flex h-[19px] w-[19px] items-center justify-center rounded-badge font-mono text-[10.5px] font-bold select-none num",
        roleStyles[role],
        className
      )}
      {...props}
    >
      {rank}
    </span>
  );
}

/** Badge identitas DM dengan dot atau label */
export function DmBadge({
  role,
  children,
  className,
  ...props
}: {
  role: DmRole;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const styles: Record<DmRole, string> = {
    cto: "bg-tint-cto text-dm-cto border border-tint-cto",
    headit: "bg-tint-headit text-dm-headit border border-tint-headit",
    finance: "bg-tint-finance text-dm-finance border border-tint-finance",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium",
        styles[role],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
