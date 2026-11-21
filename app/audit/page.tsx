/**
 * T15 — /audit eksklusif CTO.
 * Tabel waktu, aktor, aksi, detail JSON. Filter per aktor & aksi, terbaru dulu.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { requireRank } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { DmBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_BY_RANK } from "@/components/konsensus/types";

export const metadata: Metadata = {
  title: "Audit · SysSelect GDSS",
};

const AKSI_TERCATAT = [
  "login",
  "simpan_kriteria",
  "simpan_vendor",
  "mulai_penilaian",
  "simpan_nilai",
  "submit_penilaian",
  "buka_konsensus",
  "hitung_borda",
  "sahkan_keputusan",
];

const selectClass =
  "h-9 rounded-input border border-hairline-2 bg-surface px-2.5 text-[13px] text-ink focus-ring";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ aktor?: string; aksi?: string }>;
}) {
  const user = await requireRank(3);
  const overview = await getSessionOverview();
  const params = await searchParams;

  const aktorId = params.aktor && /^\d+$/.test(params.aktor) ? Number(params.aktor) : undefined;
  const aksi = params.aksi && AKSI_TERCATAT.includes(params.aksi) ? params.aksi : undefined;

  const [users, aksiCounts, logs] = await Promise.all([
    prisma.user.findMany({ orderBy: { rankJabatan: "desc" } }),
    prisma.auditLog.groupBy({ by: ["aksi"], _count: { aksi: true } }),
    prisma.auditLog.findMany({
      where: {
        ...(aktorId ? { userId: aktorId } : {}),
        ...(aksi ? { aksi } : {}),
      },
      include: { user: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
    }),
  ]);

  const jumlahAksi = new Map(aksiCounts.map((a) => [a.aksi, a._count.aksi]));
  const aksiList = [...AKSI_TERCATAT, ...aksiCounts.map((a) => a.aksi).filter((a) => !AKSI_TERCATAT.includes(a))];
  const adaFilter = Boolean(aktorId || aksi);

  return (
    <AppShell user={user} overview={overview}>
      <div className="mb-6">
        <p className="label-caps mb-1.5">Audit</p>
        <h1 className="text-display mb-1.5">Jejak aktivitas</h1>
        <p className="max-w-[680px] text-ink-2">
          Semua aksi tercatat dengan aktor dan waktu: login, setup, penilaian, konsensus,
          dan pengesahan. Hanya CTO yang dapat membuka halaman ini.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            {logs.length} baris ditampilkan, terbaru lebih dulu. Filter berlaku di server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/audit" className="mb-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
              Aktor
              <select name="aktor" defaultValue={aktorId ? String(aktorId) : ""} className={selectClass}>
                <option value="">Semua aktor</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.namaLengkap} — {u.jabatan}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
              Aksi
              <select name="aksi" defaultValue={aksi ?? ""} className={selectClass}>
                <option value="">Semua aksi</option>
                {aksiList.map((a) => (
                  <option key={a} value={a}>
                    {a} ({jumlahAksi.get(a) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
            {adaFilter ? (
              <Link href="/audit" className={buttonVariants({ variant: "ghost" })}>
                Reset
              </Link>
            ) : null}
          </form>

          {logs.length === 0 ? (
            <p className="border-t border-hairline pt-4 text-small text-ink-2">
              Tidak ada catatan untuk filter ini.
            </p>
          ) : (
            <Table data-testid="audit-table" aria-label="Audit log sesi">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[190px]">Waktu</TableHead>
                  <TableHead className="w-[190px]">Aktor</TableHead>
                  <TableHead className="w-[170px]">Aksi</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const role = ROLE_BY_RANK[log.user.rankJabatan] ?? "finance";
                  return (
                    <TableRow key={log.id} data-testid="audit-row" data-aksi={log.aksi} data-aktor={log.user.username}>
                      <TableCell className="whitespace-nowrap align-top">
                        <time dateTime={log.createdAt.toISOString()} className="mono num text-[12px]">
                          {log.createdAt.toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </time>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <DmBadge role={role}>
                            {role === "headit" ? "HIT" : role === "finance" ? "FIN" : "CTO"}
                          </DmBadge>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-ink">{log.user.namaLengkap}</p>
                            <p className="text-[11px] text-ink-2">{log.user.jabatan}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="mono text-[12px] font-medium">{log.aksi}</span>
                      </TableCell>
                      <TableCell className="align-top">
                        {log.detail === null ? (
                          <span className="text-small text-ink-2">—</span>
                        ) : (
                          <pre className="max-w-[520px] whitespace-pre-wrap break-words rounded-input bg-surface-2 px-2 py-1.5 font-mono num text-[11px] leading-relaxed text-ink-2">
                            {JSON.stringify(log.detail, null, 2)}
                          </pre>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
