import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Dashboard · SysSelect GDSS",
};

const STATUS_LABEL: Record<string, string> = {
  setup: "Setup",
  penilaian: "Penilaian",
  konsensus: "Konsensus",
  sah: "Sah",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  return (
    <AppShell user={user} overview={overview}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps mb-1.5">Dashboard</p>
          <h1 className="text-display">
            Selamat datang, {user.namaLengkap.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-ink-2">
            {user.jabatan} · rank {user.rankJabatan}
          </p>
        </div>
        <Badge variant="outline">
          Status sesi:{" "}
          {overview ? STATUS_LABEL[overview.session.status] : "belum ada"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identitas</CardTitle>
            <CardDescription>Sesi terverifikasi di server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-small">
            <p className="text-ink">{user.namaLengkap}</p>
            <p className="text-ink-2">{user.jabatan}</p>
            <p className="mono text-ink-3">
              rank {user.rankJabatan} · uid {user.id}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progres Penilaian</CardTitle>
            <CardDescription>Penanda submit per decision maker</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-hero-num num">
              {overview?.submitted ?? 0}
              <span className="text-[16px] text-ink-3">
                /{overview?.dmCount ?? 3}
              </span>
            </p>
            <p className="mt-1 text-small text-ink-2">
              Konsensus terbuka setelah seluruh DM submit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guard Role</CardTitle>
            <CardDescription>Ditegakkan di server, bukan UI</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-small text-ink-2">
              Halaman setup dan audit hanya dapat dibuka rank 3. Akun rank 1–2
              mendapat 404 dari helper <span className="mono">requireRank(3)</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
