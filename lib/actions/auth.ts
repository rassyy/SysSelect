"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";

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

  await createSession(user);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
