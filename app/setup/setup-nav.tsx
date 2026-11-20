import Link from "next/link";
import { cn } from "@/lib/utils";

export function SetupNav({ active }: { active: "kriteria" | "vendor" }) {
  return (
    <div className="mb-6 flex items-center gap-2 border-b border-hairline pb-2.5">
      <Link
        href="/setup/kriteria"
        className={cn(
          "rounded-input px-3 py-1.5 text-[13px] font-medium transition-colors",
          active === "kriteria"
            ? "bg-track text-ink font-semibold"
            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        )}
      >
        1. Bobot Kriteria
      </Link>
      <Link
        href="/setup/vendor"
        className={cn(
          "rounded-input px-3 py-1.5 text-[13px] font-medium transition-colors",
          active === "vendor"
            ? "bg-track text-ink font-semibold"
            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        )}
      >
        2. Data Vendor
      </Link>
    </div>
  );
}
