import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, DmRankBadge, type DmRole } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard · SysSelect GDSS",
};

const STATUS_LABEL: Record<string, string> = {
  setup: "Setup",
  penilaian: "Penilaian",
  konsensus: "Konsensus",
  sah: "Sah",
};

const ROLE_BY_RANK: Record<number, DmRole> = {
  3: "cto",
  2: "headit",
  1: "finance",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  const session = overview?.session;
  const status = session?.status ?? "setup";

  // Ambil data DM dan status submit masing-masing
  const [allUsers, submissions, recentAudits] = await Promise.all([
    prisma.user.findMany({ orderBy: { rankJabatan: "desc" } }),
    session
      ? prisma.submission.findMany({ where: { sessionId: session.id } })
      : Promise.resolve([]),
    session
      ? prisma.auditLog.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  const submittedUserIds = new Set(submissions.map((s) => s.userId));
  const mySubmission = submittedUserIds.has(user.id);
  const submitCount = submissions.length;
  const isAllSubmitted = submitCount === 3;

  // Tentukan tombol aksi utama (RANCANGAN.md 4.4)
  let actionButton: {
    label: string;
    href?: string;
    disabled?: boolean;
    reason?: string;
  };

  if (status === "setup") {
    if (user.rankJabatan === 3) {
      actionButton = {
        label: "Lengkapi Kriteria & Vendor",
        href: "/setup/kriteria",
      };
    } else {
      actionButton = {
        label: "Menunggu CTO menyiapkan sesi",
        disabled: true,
        reason: "Konfigurasi kriteria dan vendor sedang dipersiapkan oleh CTO.",
      };
    }
  } else if (status === "penilaian") {
    if (!mySubmission) {
      actionButton = {
        label: "Isi Penilaian Saya",
        href: "/penilaian",
      };
    } else if (!isAllSubmitted) {
      actionButton = {
        label: `Menunggu DM lain (${submitCount}/3)`,
        disabled: true,
        reason: "Menunggu seluruh decision maker menyelesaikan penilaian individual.",
      };
    } else {
      if (user.rankJabatan === 3) {
        actionButton = {
          label: "Buka Konsensus",
          href: "/konsensus",
        };
      } else {
        actionButton = {
          label: "Menunggu CTO membuka konsensus",
          disabled: true,
          reason: "Penilaian 3/3 lengkap. Menunggu CTO membuka fase konsensus.",
        };
      }
    }
  } else if (status === "konsensus") {
    if (user.rankJabatan === 3) {
      actionButton = {
        label: "Sahkan Keputusan",
        href: "/hasil",
      };
    } else {
      actionButton = {
        label: "Lihat Hasil Konsensus",
        href: "/konsensus",
      };
    }
  } else {
    actionButton = {
      label: "Lihat Hasil Akhir",
      href: "/hasil",
    };
  }

  return (
    <AppShell user={user} overview={overview}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-5">
        <div>
          <p className="label-caps mb-1.5">Dashboard</p>
          <h1 className="text-display">
            Selamat datang, {user.namaLengkap.split(" ")[0]}
          </h1>
          <p className="mt-1 text-ink-2">
            {user.jabatan} · rank {user.rankJabatan}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-2.5 py-1 text-[12px]">
            Fase: <strong className="text-ink ml-1">{STATUS_LABEL[status]}</strong>
          </Badge>

          {actionButton.href ? (
            <Link href={actionButton.href}>
              <Button variant="primary">
                <span>{actionButton.label}</span>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              disabled={actionButton.disabled}
              disabledReason={actionButton.reason}
            >
              {actionButton.label}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Kartu 1: Identitas Decision Maker */}
        <Card>
          <CardHeader className="pb-2.5">
            <CardTitle>Identitas Terverifikasi</CardTitle>
            <CardDescription>Sesi login aktif terenkripsi HMAC</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-small">
            <p className="font-semibold text-ink">{user.namaLengkap}</p>
            <p className="text-ink-2">{user.jabatan}</p>
            <div className="pt-2 flex items-center gap-2">
              <DmRankBadge role={ROLE_BY_RANK[user.rankJabatan] ?? "finance"} rank={user.rankJabatan} />
              <span className="mono text-ink-3 text-[11.5px]">
                rank_{user.rankJabatan} · @{user.username}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kartu 2: Progres Penilaian n/3 (RANCANGAN.md 4.0) */}
        <Card>
          <CardHeader className="pb-2.5">
            <CardTitle>Progres Penilaian</CardTitle>
            <CardDescription>Status submisi individual 3 Decision Maker</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-hero-num num mono font-bold text-ink">
                {submitCount}
              </span>
              <span className="text-[16px] text-ink-3 mono font-medium">
                / {overview?.dmCount ?? 3}
              </span>
            </div>

            <div className="space-y-2 border-t border-hairline pt-3">
              {allUsers.map((u) => {
                const role = ROLE_BY_RANK[u.rankJabatan] ?? "finance";
                const hasSubmitted = submittedUserIds.has(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <DmRankBadge role={role} rank={u.rankJabatan} />
                      <span className={cn("font-medium", u.id === user.id ? "text-ink" : "text-ink-2")}>
                        {u.namaLengkap.split(" ")[0]}
                        {u.id === user.id ? " (Anda)" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasSubmitted ? (
                        <span className="inline-flex items-center gap-1 rounded-badge border border-hairline-2 bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink">
                          <Check size={11} strokeWidth={2.5} />
                          Submit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-badge border border-hairline bg-track px-2 py-0.5 text-[11px] text-ink-3">
                          <Clock size={11} strokeWidth={1.5} />
                          Menunggu
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Kartu 3: Guard Role & Mekanisme Blind */}
        <Card>
          <CardHeader className="pb-2.5">
            <CardTitle>Integritas GDSS</CardTitle>
            <CardDescription>Blind assessment & perlindungan server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-small text-ink-2">
            <p>
              Nilai decision maker lain disaring pada lapisan database (server-side guard) dan tidak pernah dikirimkan ke peramban selama fase penilaian.
            </p>
            <p className="text-[11.5px] text-ink-3 pt-1 border-t border-hairline">
              Master data eksklusif rank 3. Konsensus Borda Count baru terbuka setelah 3/3 DM submit.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 5 Aksi Audit Terakhir */}
      {recentAudits.length > 0 ? (
        <Card className="mt-6 border-hairline bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14.5px]">Aktivitas Sesi Terakhir</CardTitle>
            <CardDescription>Catatan audit log transisi dan aksi sistem</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-hairline border-t border-hairline text-[12.5px]">
              {recentAudits.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="mono text-ink-3 text-[11px]">
                      {new Date(a.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="mono font-medium text-ink">{a.aksi}</span>
                    <span className="text-ink-2 text-[12px]">
                      oleh {a.user.namaLengkap.split(" ")[0]} ({a.user.jabatan})
                    </span>
                  </div>
                  <span className="mono text-[10.5px] text-ink-3">
                    {new Date(a.createdAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
