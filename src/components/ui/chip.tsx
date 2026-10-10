import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Small rounded label used for priority, category and status badges. */
export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        className,
      )}
      {...props}
    />
  );
}
