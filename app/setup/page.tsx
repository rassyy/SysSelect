import type { Metadata } from "next";
import { requireRank, getSessionStatus } from "@/lib/auth";
import { Navbar } from "@/components/app-shell/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Setup · SysSelect GDSS",
};

/**
 * Placeholder T03. Guard rank 3 sudah aktif di server;
 * isi halaman dikerjakan pada T05/T06.
 */
export default async function SetupPage() {
  const user = await requireRank(3);
  const status = await getSessionStatus();

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto max-w-[1120px] px-8 py-8">
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
              {status ?? "belum ada"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-small text-ink-2">
              Form kriteria dan vendor akan diisi pada sesi H2 (T05–T06).
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
