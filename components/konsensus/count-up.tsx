"use client";

/**
 * Angka menghitung naik 0 -> nilai akhir (DESIGN.md 5.1: 600ms easeOutCubic).
 * playing=false (sudah dilihat / reduced-motion) -> langsung state akhir.
 * Remount via key={playKey} untuk mengulang animasi.
 */
import * as React from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

export function CountUp({
  value,
  decimals = 4,
  playing,
  delay = 1.4,
  duration = 0.6,
  className,
}: {
  value: number;
  decimals?: number;
  playing: boolean;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(playing ? 0 : value);
  const text = useTransform(mv, (v) => v.toFixed(decimals));

  React.useEffect(() => {
    if (!playing) {
      mv.set(value);
      return;
    }
    mv.set(0);
    const controls = animate(mv, value, {
      duration,
      delay,
      ease: [...EASE_OUT_CUBIC],
    });
    return () => controls.stop();
  }, [playing, value, delay, duration, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
