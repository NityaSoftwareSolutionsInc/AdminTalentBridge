"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Primary mark — three overlapping nodes (people / systems / outcomes). */
export function TalentBridgeMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const a = `tb-mark-a-${uid}`;
  const b = `tb-mark-b-${uid}`;
  const c = `tb-mark-c-${uid}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={a} x1="8" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id={b} x1="20" y1="6" x2="40" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={c} x1="14" y1="20" x2="34" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="17.5" r="12.5" fill={`url(#${a})`} fillOpacity="0.95" />
      <circle cx="30" cy="17.5" r="12.5" fill={`url(#${b})`} fillOpacity="0.94" />
      <circle cx="24" cy="29.5" r="12.5" fill={`url(#${c})`} fillOpacity="0.9" />
    </svg>
  );
}
