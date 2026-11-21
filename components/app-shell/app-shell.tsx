import Link from "next/link";
import type { User } from "@prisma/client";
import type { SessionOverview } from "@/lib/session-state";
import { logoutAction } from "@/lib/actions/auth";
import { PhaseRail } from "@/components/app-shell/phase-rail";
import { NavLinks } from "@/components/app-shell/nav-links";
import { DmBadge, DmRankBadge, type DmRole } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const ROLE_BY_RANK: Record<number, DmRole> = {
  3: "cto",
  2: "headit",
  1: "finance",
};

function Brand() {
  return (
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
  );
}

function Identity({ user, compact = false }: { user: User; compact?: boolean }) {
  const role = ROLE_BY_RANK[user.rankJabatan] ?? "finance";

  if (compact) {
    return (
      <DmBadge role={role}>
        {user.username.toUpperCase()} · {user.rankJabatan}
      </DmBadge>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <DmRankBadge role={role} rank={user.rankJabatan} className="mt-0.5" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[12.5px] font-medium text-ink">
          {user.namaLengkap}
        </p>
        <p className="truncate text-[11px] text-ink-2">{user.jabatan}</p>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="ghost" type="submit" title="Keluar dari sesi">
        <LogOut size={15} strokeWidth={1.5} />
        Keluar
      </Button>
    </form>
  );
}

/**
 * Shell aplikasi: rail navigasi kiri tipis, PhaseRail persisten,
 * konten maksimal 1120px rata kiri dengan padding 32px (DESIGN.md 3).
 */
export function AppShell({
  user,
  overview,
  children,
}: {
  user: User;
  overview: SessionOverview | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[192px] shrink-0 flex-col border-r border-hairline bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-hairline px-5">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <p className="label-caps px-5 pb-2">Menu</p>
          <NavLinks rank={user.rankJabatan} />
        </div>

        <div className="space-y-3 border-t border-hairline p-4">
          <Identity user={user} />
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-hairline bg-surface px-5 md:hidden">
          <Brand />
          <div className="flex items-center gap-2">
            <Identity user={user} compact />
            <LogoutButton />
          </div>
        </div>

        <div className="border-b border-hairline bg-surface px-5 py-2 md:hidden">
          <NavLinks rank={user.rankJabatan} orientation="horizontal" />
        </div>

        <PhaseRail
          status={overview?.session.status ?? null}
          submitted={overview?.submitted ?? 0}
          dmCount={overview?.dmCount ?? 3}
        />

        <main className="w-full max-w-[1120px] px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
