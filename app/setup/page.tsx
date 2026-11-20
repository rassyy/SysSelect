import type { Metadata } from "next";
import { requireRank } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Setup · SysSelect GDSS",
};

/**
 * Placeholder T04. Guard rank 3 aktif di server;
 * form kriteria dan vendor dikerjakan pada T05/T06.
 */
export default async function SetupPage() {
  const user = await requireRank(3);
  const overview = await getSessionOverview();

  return (
    <AppShell user={user} overview={overview}>
      <p className="label-caps mb-1.5">Fase Setup</p>
      <h1 className="text-display mb-1.5">Master data sesi</h1>
      <p className="mb-6 text-ink-2">
        Hanya Chief Technology Officer yang dapat membuka halaman ini.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Guard aktif</CardTitle>
          <CardDescription>
            requireRank(3) meloloskan {user.jabatan}; status sesi saat ini{" "}
            {overview?.session.status ?? "belum ada"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-small text-ink-2">
            Form kriteria (Σbobot = 100) dan vendor akan diisi pada sesi H2
            (T05–T06).
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
