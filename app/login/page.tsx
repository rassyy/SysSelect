import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Masuk · SysSelect GDSS",
};

const ERRORS: Record<string, string> = {
  kosong: "Username dan password wajib diisi.",
  salah: "Username atau password tidak cocok.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Gagal masuk." : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-6">
          <p className="label-caps mb-2">Sistem Pendukung Keputusan Kelompok</p>
          <h1 className="text-display">SysSelect GDSS</h1>
          <p className="mt-2 text-small text-ink-2">
            Pemilihan vendor managed cloud service provider. Tiga akun decision
            maker, tanpa registrasi.
          </p>
        </div>

        <div className="card p-6">
          <form action={loginAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-[12.5px] font-medium text-ink"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="h-9 w-full rounded-input border border-hairline-2 bg-surface px-3 text-[13.5px] text-ink focus-ring"
                placeholder="cto"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[12.5px] font-medium text-ink"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-9 w-full rounded-input border border-hairline-2 bg-surface px-3 text-[13.5px] text-ink focus-ring"
                placeholder="••••••••"
              />
            </div>

            {message ? (
              <p
                role="alert"
                className="rounded-input border border-hairline-2 bg-surface-2 px-3 py-2 text-small text-ink-2"
              >
                {message}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              <Lock size={15} strokeWidth={1.5} />
              Masuk
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11.5px] text-ink-3">
          Sesi berakhir otomatis setelah 8 jam.
        </p>
      </div>
    </main>
  );
}
