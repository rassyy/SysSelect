/**
 * Verifikasi isi database terhadap golden fixture.
 * Jalankan: npm run db:verify
 *
 * Yang dicek:
 *  1. Jumlah baris tiap tabel sesuai T02.
 *  2. Tidak ada hash placeholder.
 *  3. Nilai 60 assessments sama persis dengan golden_fixture.json.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

type Fixture = {
  per_dm: Record<string, { raw: number[][] }>;
};

const EXPECTED_COUNTS: Array<[string, number]> = [
  ["users", 3],
  ["criteria", 5],
  ["vendors", 4],
  ["sessions", 1],
  ["borda_weights", 4],
  ["assessments", 60],
  ["submissions", 0],
  ["saw_results", 0],
  ["borda_results", 0],
];

const DM_KEY: Record<string, string> = {
  cto: "CTO",
  headit: "HEAD_IT",
  finance: "FINANCE",
};

async function main() {
  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "golden_fixture.json"), "utf8"),
  ) as Fixture;

  const counts = {
    users: await prisma.user.count(),
    criteria: await prisma.criteria.count(),
    vendors: await prisma.vendor.count(),
    sessions: await prisma.session.count(),
    borda_weights: await prisma.bordaWeight.count(),
    assessments: await prisma.assessment.count(),
    submissions: await prisma.submission.count(),
    saw_results: await prisma.sawResult.count(),
    borda_results: await prisma.bordaResult.count(),
  } as Record<string, number>;

  let failed = false;

  console.log("Jumlah baris:");
  for (const [table, expected] of EXPECTED_COUNTS) {
    const actual = counts[table];
    const ok = actual === expected;
    if (!ok) failed = true;
    console.log(
      `  ${ok ? "OK  " : "FAIL"} ${table.padEnd(15)} ${actual} (harus ${expected})`,
    );
  }

  const placeholders = await prisma.user.count({
    where: { passwordHash: { contains: "GANTI_DENGAN_HASH" } },
  });
  if (placeholders > 0) {
    failed = true;
    console.log(`  FAIL password_hash placeholder = ${placeholders}`);
  } else {
    console.log("  OK   password_hash   tidak ada placeholder");
  }

  // Cocokkan 60 nilai mentah dengan golden fixture.
  const users = await prisma.user.findMany();
  const vendors = await prisma.vendor.findMany({
    orderBy: { kode: "asc" },
  });
  const criteria = await prisma.criteria.findMany({
    orderBy: { urutan: "asc" },
  });
  const session = await prisma.session.findFirstOrThrow();
  const assessments = await prisma.assessment.findMany({
    where: { sessionId: session.id },
  });

  const byKey = new Map(
    assessments.map((a) => [
      `${a.userId}:${a.vendorId}:${a.criterionId}`,
      Number(a.nilai),
    ]),
  );

  let mismatches = 0;
  for (const user of users) {
    const fixtureKey = DM_KEY[user.username];
    if (!fixtureKey) continue;
    const raw = fixture.per_dm[fixtureKey].raw;
    vendors.forEach((vendor, vi) => {
      criteria.forEach((criterion, ci) => {
        const actual = byKey.get(`${user.id}:${vendor.id}:${criterion.id}`);
        const expected = raw[vi][ci];
        if (actual !== expected) {
          mismatches++;
          console.log(
            `  FAIL ${user.username} ${vendor.kode} ${criterion.kode}: ` +
              `db=${actual} fixture=${expected}`,
          );
        }
      });
    });
  }

  if (mismatches === 0) {
    console.log("  OK   nilai assessments identik dengan golden_fixture.json");
  } else {
    failed = true;
    console.log(`  FAIL total ketidakcocokan nilai = ${mismatches}`);
  }

  if (failed) {
    console.error("\nVerifikasi GAGAL.");
    process.exitCode = 1;
  } else {
    console.log("\nVerifikasi LULUS.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
