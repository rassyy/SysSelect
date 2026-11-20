import Link from "next/link";
import type { User } from "@prisma/client";
import { logoutAction } from "@/lib/actions/auth";
import { DmBadge, DmRankBadge, type DmRole } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const ROLE_BY_RANK: Record<number, DmRole> = {
  3: "cto",
  2: "headit",
  1: "finance",
};

export function Navbar({ user }: { user: User }) {
  const role = ROLE_BY_RANK[user.rankJabatan] ?? "finance";

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-ink"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-badge bg-ink font-mono text-[11px] font-bold text-surface">
            SS
          </span>
          SysSelect
          <span className="font-normal text-ink-3">GDSS</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <DmRankBadge role={role} rank={user.rankJabatan} />
            <div className="leading-tight">
              <p className="text-[12.5px] font-medium text-ink">
                {user.namaLengkap}
              </p>
              <p className="text-[11px] text-ink-3">{user.jabatan}</p>
            </div>
          </div>
          <DmBadge role={role} className="sm:hidden">
            {user.username.toUpperCase()}
          </DmBadge>

          <form action={logoutAction}>
            <Button variant="ghost" type="submit" title="Keluar dari sesi">
              <LogOut size={15} strokeWidth={1.5} />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
