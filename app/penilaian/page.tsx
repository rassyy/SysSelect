import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { PenilaianGrid } from "./penilaian-grid";

export const metadata: Metadata = {
  title: "Penilaian Individual · SysSelect GDSS",
};

export default async function PenilaianPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();
  const session = overview?.session;

  const [criteria, vendors, allUsers, submissions] = await Promise.all([
    prisma.criteria.findMany({ orderBy: { urutan: "asc" } }),
    prisma.vendor.findMany({ orderBy: { kode: "asc" } }),
    prisma.user.findMany({ orderBy: { rankJabatan: "desc" } }),
    session
      ? prisma.submission.findMany({ where: { sessionId: session.id } })
      : Promise.resolve([]),
  ]);

  const submittedUserIds = new Set(submissions.map((s) => s.userId));
  const isSubmitted = submittedUserIds.has(user.id);

  // BLIND GUARD (SERVER):
  // Selama fase setup / penilaian, HANYA query nilai milik user yang login.
  const isBlind = !session || session.status === "setup" || session.status === "penilaian";

  const assessments = session
    ? await prisma.assessment.findMany({
        where: {
          sessionId: session.id,
          ...(isBlind ? { userId: user.id } : {}),
        },
      })
    : [];

  const otherDms = allUsers
    .filter((u) => u.id !== user.id)
    .map((u) => ({
      id: u.id,
      username: u.username,
      namaLengkap: u.namaLengkap,
      jabatan: u.jabatan,
      rankJabatan: u.rankJabatan,
      submitted: submittedUserIds.has(u.id),
    }));

  return (
    <AppShell user={user} overview={overview}>
      <div className="mb-6">
        <p className="label-caps mb-1.5">Fase Penilaian</p>
        <h1 className="text-display mb-1.5">Evaluasi Alternatif Vendor</h1>
        <p className="text-ink-2">
          Berikan penilaian objektif untuk 4 kandidat vendor pada 5 kriteria evaluasi.
        </p>
      </div>

      <PenilaianGrid
        initialCriteria={criteria.map((c) => ({
          id: c.id,
          kode: c.kode,
          nama: c.nama,
          bobot: Number(c.bobot),
          tipe: c.tipe as "cost" | "benefit",
          satuan: c.satuan,
          urutan: c.urutan,
        }))}
        initialVendors={vendors.map((v) => ({
          id: v.id,
          kode: v.kode,
          nama: v.nama,
          profil: v.profil,
        }))}
        initialAssessments={assessments.map((a) => ({
          id: a.id,
          userId: a.userId,
          vendorId: a.vendorId,
          criterionId: a.criterionId,
          nilai: Number(a.nilai),
          alasan: a.alasan,
        }))}
        initialSubmitted={isSubmitted}
        otherDms={otherDms}
        sessionStatus={session?.status ?? "setup"}
      />
    </AppShell>
  );
}
