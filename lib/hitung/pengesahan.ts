/**
 * T14 — Pengesahan keputusan (konsensus -> sah).
 * Guard SERVER: hanya rank 3, hanya fase konsensus, borda_results lengkap.
 * Menulis ratified_by, ratified_at, winner_vendor_id, status 'sah' + audit.
 * Satu transaksi dengan row lock yang sama seperti transisi lain.
 */
import { prisma } from "@/lib/prisma";
import { ApiTolak } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export type HasilPengesahan = {
  status: "sah";
  winnerVendorId: number;
  ratifiedAt: Date;
  ratifiedBy: number;
};

export async function sahkanKeputusan(
  sessionId: number,
  actorId: number,
): Promise<HasilPengesahan> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.status === "sah") {
      throw new ApiTolak(409, "Sesi sudah disahkan. Seluruh data read-only.");
    }
    if (session.status !== "konsensus") {
      throw new ApiTolak(409, "Pengesahan hanya bisa dilakukan pada fase konsensus.");
    }

    const borda = await tx.bordaResult.findMany({
      where: { sessionId },
      orderBy: { peringkatAkhir: "asc" },
    });
    if (borda.length !== 4) {
      throw new ApiTolak(409, `borda_results belum lengkap (${borda.length}/4).`);
    }
    const winner = borda.find((r) => r.peringkatAkhir === 1);
    if (!winner) throw new ApiTolak(409, "Pemenang Borda belum ditentukan.");

    const ratifiedAt = new Date();
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: "sah",
        ratifiedBy: actorId,
        ratifiedAt,
        winnerVendorId: winner.vendorId,
      },
    });

    await recordAudit(sessionId, actorId, "sahkan_keputusan", {
      winnerVendorId: winner.vendorId,
      nilaiBorda: Number(winner.nilaiBorda),
      ratifiedAt,
    }, tx);

    return {
      status: "sah",
      winnerVendorId: winner.vendorId,
      ratifiedAt: updated.ratifiedAt ?? ratifiedAt,
      ratifiedBy: actorId,
    };
  });
}
