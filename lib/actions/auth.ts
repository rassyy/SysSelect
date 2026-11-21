"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=kosong");
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !valid) {
    redirect("/login?error=salah");
  }

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  await recordAudit(session?.id ?? null, user.id, "login", { username: user.username });
  await createSession(user);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
