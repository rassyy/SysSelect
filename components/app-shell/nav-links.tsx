"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Scale,
  FileCheck2,
  SlidersHorizontal,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRank?: number;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/penilaian", label: "Penilaian", icon: ClipboardList },
  { href: "/konsensus", label: "Konsensus", icon: Scale },
  { href: "/hasil", label: "Hasil", icon: FileCheck2 },
  { href: "/setup", label: "Setup", icon: SlidersHorizontal, minRank: 3 },
  { href: "/audit", label: "Audit", icon: ScrollText, minRank: 3 },
];

export function navItemsForRank(rank: number): NavItem[] {
  return ITEMS.filter((item) => !item.minRank || rank >= item.minRank);
}

export function NavLinks({
  rank,
  orientation = "vertical",
}: {
  rank: number;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const items = navItemsForRank(rank);

  return (
    <nav
      aria-label="Navigasi utama"
      className={
        orientation === "vertical"
          ? "flex flex-col gap-0.5 px-3"
          : "flex gap-1 overflow-x-auto"
      }
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2.5 rounded-input px-2.5 text-[13px] transition-colors duration-[140ms]",
              active
                ? "bg-track font-medium text-ink"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={15} strokeWidth={1.5} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
