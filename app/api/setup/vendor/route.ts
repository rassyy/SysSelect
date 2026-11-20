/**
 * T06 — CRUD vendor data. Eksklusif rank 3, hanya fase setup.
 * Catat audit_log 'simpan_vendor'.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  apiError,
  apiJson,
  isApiFailure,
  readJson,
  requireApiRank,
  requireApiUser,
} from "@/lib/api";

export async function GET(request: NextRequest) {
  const guard = await requireApiUser(request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const vendors = await prisma.vendor.findMany({
    orderBy: { kode: "asc" },
  });
  return apiJson({ vendors });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(409, "Belum ada sesi.");
  if (session.status !== "setup") {
    return apiError(409, "Vendor hanya bisa diubah saat fase setup.");
  }

  const body = (await readJson(request)) as { id?: number } | null;
  if (!body || typeof body.id !== "number") {
    return apiError(400, "id vendor wajib diisi.");
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: body.id } });
  if (!vendor) return apiError(404, "Vendor tidak ditemukan.");

  const referenced = await prisma.assessment.count({
    where: { vendorId: vendor.id },
  });
  if (referenced > 0) {
    return apiError(409, "Vendor sudah memiliki nilai penilaian, tidak bisa dihapus.");
  }

  await prisma.vendor.delete({ where: { id: vendor.id } });
  await recordAudit(session.id, guard.id, "simpan_vendor", {
    hapus: true,
    vendorId: vendor.id,
    kode: vendor.kode,
  });

  return apiJson({ ok: true });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(409, "Belum ada sesi.");
  if (session.status !== "setup") {
    return apiError(409, "Vendor hanya bisa diubah saat fase setup.");
  }

  const body = (await readJson(request)) as {
    id?: number;
    kode?: string;
    nama?: string;
    profil?: string;
  } | null;

  if (!body || typeof body !== "object") {
    return apiError(400, "Body JSON tidak valid.");
  }

  const { id, kode, nama, profil } = body;
  if (!kode || typeof kode !== "string" || !kode.trim()) {
    return apiError(400, "Kode vendor wajib diisi.");
  }
  if (!nama || typeof nama !== "string" || !nama.trim()) {
    return apiError(400, "Nama vendor wajib diisi.");
  }

  const cleanKode = kode.trim().toUpperCase();
  const cleanNama = nama.trim();
  const cleanProfil = typeof profil === "string" ? profil.trim() : null;

  let vendor;
  if (id && typeof id === "number") {
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return apiError(404, "Vendor tidak ditemukan.");

    vendor = await prisma.vendor.update({
      where: { id },
      data: {
        kode: cleanKode,
        nama: cleanNama,
        profil: cleanProfil,
      },
    });
  } else {
    const existing = await prisma.vendor.findUnique({ where: { kode: cleanKode } });
    if (existing) {
      vendor = await prisma.vendor.update({
        where: { kode: cleanKode },
        data: {
          nama: cleanNama,
          profil: cleanProfil,
        },
      });
    } else {
      const count = await prisma.vendor.count();
      if (count >= 4) {
        return apiError(400, "Maksimal 4 vendor. Edit vendor yang ada.");
      }
      vendor = await prisma.vendor.create({
        data: {
          kode: cleanKode,
          nama: cleanNama,
          profil: cleanProfil,
          createdBy: guard.id,
        },
      });
    }
  }

  await recordAudit(session.id, guard.id, "simpan_vendor", {
    vendorId: vendor.id,
    kode: vendor.kode,
    nama: vendor.nama,
  });

  return apiJson({ vendor });
}
