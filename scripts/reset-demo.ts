/**
 * Reset ke kondisi demo bersih: sesi kembali `setup` tanpa penilaian.
 * Master data (users, criteria, vendors, borda_weights) dipertahankan.
 * Jalankan: npm run db:reset:demo
 */
import { PrismaClient, SessionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.findFirst({
    orderBy: { id: "asc" },
  });

  if (!session) {
    throw new Error("Tidak ada sesi. Jalankan db:seed:golden dulu.");
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { sessionId: session.id } }),
    prisma.bordaResult.deleteMany({ where: { sessionId: session.id } }),
    prisma.sawResult.deleteMany({ where: { sessionId: session.id } }),
    prisma.submission.deleteMany({ where: { sessionId: session.id } }),
    prisma.assessment.deleteMany({ where: { sessionId: session.id } }),
    prisma.session.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.setup,
        openedBy: null,
        openedAt: null,
        ratifiedBy: null,
        ratifiedAt: null,
        winnerVendorId: null,
      },
    }),
  ]);

  const [assessments, submissions, saw, borda] = await Promise.all([
    prisma.assessment.count({ where: { sessionId: session.id } }),
    prisma.submission.count({ where: { sessionId: session.id } }),
    prisma.sawResult.count({ where: { sessionId: session.id } }),
    prisma.bordaResult.count({ where: { sessionId: session.id } }),
  ]);

  console.log(`Sesi "${session.nama}" direset ke status setup.`);
  console.log(`  assessments = ${assessments}`);
  console.log(`  submissions = ${submissions}`);
  console.log(`  saw_results = ${saw}`);
  console.log(`  borda_results = ${borda}`);
  console.log("Siap untuk presentasi blind.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
