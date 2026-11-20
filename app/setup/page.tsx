import { redirect } from "next/navigation";
import { requireRank } from "@/lib/auth";

export default async function SetupRootPage() {
  await requireRank(3);
  redirect("/setup/kriteria");
}
