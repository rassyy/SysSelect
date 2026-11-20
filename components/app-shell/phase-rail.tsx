import Link from "next/link";
import { Check } from "lucide-react";
import type { SessionStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type Phase = {
  key: SessionStatus;
  label: string;
  href: string;
};

const PHASES: Phase[] = [
  { key: "setup", label: "Setup", href: "/setup" },
  { key: "penilaian", label: "Penilaian", href: "/penilaian" },
  { key: "konsensus", label: "Konsensus", href: "/konsensus" },
  { key: "sah", label: "Sah", href: "/hasil" },
];

type PhaseState = "selesai" | "aktif" | "terkunci";

function lockedReason(
  phase: SessionStatus,
  status: SessionStatus | null,
  submitted: number,
  dmCount: number,
): string {
  if (!status) return "belum ada sesi";
  switch (phase) {
    case "penilaian":
      return "menunggu master data";
    case "konsensus":
      return status === "penilaian"
        ? `menunggu ${submitted}/${dmCount}`
        : "menunggu 3/3";
    case "sah":
      return status === "konsensus"
        ? "menunggu pengesahan CTO"
        : "menunggu konsensus";
    default:
      return "terkunci";
  }
}

/**
 * PhaseRail — persisten di semua halaman (DESIGN.md 4.1).
 * Tinggi 48px. Fase selesai bisa diklik, fase terkunci wajib menulis alasan.
 */
export function PhaseRail({
  status,
  submitted,
  dmCount,
}: {
  status: SessionStatus | null;
  submitted: number;
  dmCount: number;
}) {
  const currentIndex = status ? PHASES.findIndex((p) => p.key === status) : -1;

  return (
    <div
      className="flex h-12 items-center gap-2 border-b border-hairline bg-surface px-8"
      aria-label="Fase keputusan"
    >
      {PHASES.map((phase, i) => {
        const state: PhaseState =
          currentIndex < 0
            ? "terkunci"
            : i < currentIndex
              ? "selesai"
              : i === currentIndex
                ? "aktif"
                : "terkunci";

        const reason =
          state === "terkunci"
            ? lockedReason(phase.key, status, submitted, dmCount)
            : null;

        const dot = (
          <span
            className={cn(
              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
              state === "terkunci"
                ? "border border-hairline-2 bg-canvas text-ink-3"
                : "bg-ink text-surface",
              state === "aktif" && "ring-[3px] ring-ink/10",
            )}
            aria-hidden
          >
            {state === "selesai" ? (
              <Check size={10} strokeWidth={3} />
            ) : (
              i + 1
            )}
          </span>
        );

        const label = (
          <span className="flex min-w-0 flex-col leading-tight">
            <span
              className={cn(
                "text-[12.5px]",
                state === "aktif" && "font-semibold text-ink",
                state === "selesai" && "text-ink-2",
                state === "terkunci" && "text-ink-3",
              )}
            >
              {phase.label}
            </span>
            {reason ? (
              <span className="text-[10.5px] text-ink-3">{reason}</span>
            ) : null}
          </span>
        );

        const content = (
          <span className="flex items-center gap-2">
            {dot}
            {label}
          </span>
        );

        return (
          <div key={phase.key} className="flex min-w-0 flex-1 items-center gap-2">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  currentIndex > i - 1 ? "bg-ink-3" : "bg-hairline",
                )}
              />
            ) : null}

            {state === "selesai" ? (
              <Link
                href={phase.href}
                className="rounded-input px-1 py-0.5 transition-colors duration-[140ms] hover:bg-surface-2"
                title={`Buka fase ${phase.label}`}
              >
                {content}
              </Link>
            ) : (
              <span
                className="px-1 py-0.5"
                title={reason ?? `Fase ${phase.label}`}
                aria-current={state === "aktif" ? "step" : undefined}
              >
                {content}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
