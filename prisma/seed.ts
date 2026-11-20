/**
 * Seed golden fixture SysSelect GDSS.
 *
 * Sumber angka: docs/golden_fixture.json + docs/schema.sql.
 * Jalankan: npm run db:seed:golden
 *
 * Seed ini sengaja mengisi 60 baris assessments (3 DM x 4 vendor x 5 kriteria)
 * dan TIDAK mengisi submissions, saw_results, maupun borda_results.
 * Dengan begitu sesi tetap di status `setup` dan mesin hitung H3 yang
 * membuktikan angka golden, bukan seed yang menulis hasil akhir.
 */
import { PrismaClient, CriteriaType, SessionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const DEV_PASSWORD = "rahasia123";

const USERS = [
  {
    username: "cto",
    namaLengkap: "Muhammad Rasya Faiz Fajar Nabil",
    jabatan: "Chief Technology Officer",
    rankJabatan: 3,
  },
  {
    username: "headit",
    namaLengkap: "Abdul Aziz Maftuh",
    jabatan: "Head of IT Infrastructure",
    rankJabatan: 2,
  },
  {
    username: "finance",
    namaLengkap: "Ichlasul Amal",
    jabatan: "Finance Manager",
    rankJabatan: 1,
  },
] as const;

const CRITERIA: Array<{
  kode: string;
  nama: string;
  bobot: number;
  tipe: CriteriaType;
  satuan: string;
  urutan: number;
}> = [
  {
    kode: "C1",
    nama: "Total biaya kepemilikan 3 tahun (migrasi, operasional, dukungan)",
    bobot: 25,
    tipe: CriteriaType.cost,
    satuan: "juta Rp",
    urutan: 1,
  },
  {
    kode: "C2",
    nama: "Jaminan tingkat layanan (SLA) dan kesinambungan layanan",
    bobot: 20,
    tipe: CriteriaType.benefit,
    satuan: "skor",
    urutan: 2,
  },
  {
    kode: "C3",
    nama: "Keamanan dan kepatuhan (ISO/IEC 27001, SOC 2, UU PDP)",
    bobot: 20,
    tipe: CriteriaType.benefit,
    satuan: "skor",
    urutan: 3,
  },
  {
    kode: "C4",
    nama: "Pengalaman dan kemampuan teknis migrasi",
    bobot: 20,
    tipe: CriteriaType.benefit,
    satuan: "skor",
    urutan: 4,
  },
  {
    kode: "C5",
    nama: "Dukungan teknis, waktu respons, dan tenaga ahli lokal",
    bobot: 15,
    tipe: CriteriaType.benefit,
    satuan: "skor",
    urutan: 5,
  },
];

const VENDORS = [
  {
    kode: "V1",
    nama: "PT Awan Nusantara Cloud",
    profil:
      "Spesialis keamanan dan arsitektur; sertifikasi ISO/IEC 27001 dan SOC 2; biaya premium.",
  },
  {
    kode: "V2",
    nama: "PT Cloudra Teknologi",
    profil:
      "Integrator cloud menengah; cakupan layanan standar; harga kompetitif.",
  },
  {
    kode: "V3",
    nama: "PT Infrastruktur Prima Digital",
    profil:
      "Unggul pada SLA dan dukungan operasional 24/7; tenaga ahli lokal tersedia.",
  },
  {
    kode: "V4",
    nama: "PT Nusa Data Center",
    profil:
      "Operator data center lokal; penawaran biaya terendah; cakupan layanan terbatas.",
  },
];

type Fixture = { per_dm: Record<string, { raw: number[][] }> };

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures", "golden_fixture.json"), "utf8"),
) as Fixture;

/** username -> kunci fixture. Urutan vendor V1..V4, kriteria C1..C5. */
const DM_KEY: Record<string, string> = {
  cto: "CTO",
  headit: "HEAD_IT",
  finance: "FINANCE",
};

async function main() {
  console.log("Seed golden fixture dimulai...");

  // Hapus dengan urutan aman terhadap foreign key.
  await prisma.auditLog.deleteMany();
  await prisma.bordaResult.deleteMany();
  await prisma.bordaWeight.deleteMany();
  await prisma.sawResult.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.criteria.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  if (passwordHash.includes("GANTI_DENGAN_HASH")) {
    throw new Error("Hash bcrypt tidak valid.");
  }

  const users = new Map<string, number>();
  for (const u of USERS) {
    const row = await prisma.user.create({
      data: { ...u, passwordHash },
    });
    users.set(u.username, row.id);
  }

  const ctoId = users.get("cto")!;

  const criteriaIds = new Map<string, number>();
  for (const c of CRITERIA) {
    const row = await prisma.criteria.create({
      data: { ...c, updatedBy: ctoId },
    });
    criteriaIds.set(c.kode, row.id);
  }

  const vendorIds = new Map<string, number>();
  for (const v of VENDORS) {
    const row = await prisma.vendor.create({
      data: { ...v, createdBy: ctoId },
    });
    vendorIds.set(v.kode, row.id);
  }

  const session = await prisma.session.create({
    data: {
      nama: "Pemilihan Vendor Cloud 2026",
      status: SessionStatus.setup,
    },
  });

  await prisma.bordaWeight.createMany({
    data: [4, 3, 2, 1].map((bobot, i) => ({
      sessionId: session.id,
      peringkat: i + 1,
      bobot,
    })),
  });

  const vendorCodes = ["V1", "V2", "V3", "V4"];
  const criteriaCodes = ["C1", "C2", "C3", "C4", "C5"];

  let assessmentCount = 0;
  for (const [username, fixtureKey] of Object.entries(DM_KEY)) {
    const userId = users.get(username)!;
    const matrix = FIXTURE.per_dm[fixtureKey].raw;
    for (let vi = 0; vi < vendorCodes.length; vi++) {
      for (let ci = 0; ci < criteriaCodes.length; ci++) {
        await prisma.assessment.create({
          data: {
            sessionId: session.id,
            userId,
            vendorId: vendorIds.get(vendorCodes[vi])!,
            criterionId: criteriaIds.get(criteriaCodes[ci])!,
            nilai: matrix[vi][ci],
          },
        });
        assessmentCount++;
      }
    }
  }

  if (assessmentCount !== 60) {
    throw new Error(`Assessment harus 60 baris, dapat ${assessmentCount}.`);
  }

  console.log(`  users          = ${USERS.length}`);
  console.log(`  criteria       = ${CRITERIA.length}`);
  console.log(`  vendors        = ${VENDORS.length}`);
  console.log(`  session        = 1 (status setup)`);
  console.log(`  borda_weights  = 4`);
  console.log(`  assessments    = ${assessmentCount}`);
  console.log(`  password dev   = ${DEV_PASSWORD} (semua akun)`);
  console.log("Seed golden selesai.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
