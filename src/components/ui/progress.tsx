"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps {
  /** 0..1 */
  value: number;
  tone?: string;
  className?: string;
  label?: string;
}

export function Progress({ value, tone = "bg-primary", className, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={false}
        animate={{ width: `${clamped * 100}%` }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30 }}
      />
    </div>
  );
}
