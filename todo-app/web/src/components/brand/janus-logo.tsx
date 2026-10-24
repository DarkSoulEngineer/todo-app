import type { JSX } from "react";
import { JANUS_ART_DATA_URI } from "@/components/brand/janus-art";

/**
 * Janus brand mark.
 *
 * Janus is the Roman god of doorways, gates and thresholds — and of duality:
 * his two faces look to the past and the future at once (the month of January is
 * his). The mark is the real thing: the public-domain two-faced Janus medallion
 * from "Illustrium imagines" (1517), embedded as a base64 data URI in
 * `./janus-art.ts` so it travels with the code and needs no extra request. It is
 * white ink on transparency, so it reads on the violet tile, and it is sized
 * entirely by the caller's `className`.
 *
 * Decorative by design: it is always accompanied by the real "Janus" wordmark,
 * so it is hidden from assistive tech.
 */
export function JanusMark({ className }: { className?: string }): JSX.Element {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny inlined data URI; next/image adds nothing here.
    <img
      src={JANUS_ART_DATA_URI}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
    />
  );
}

export type JanusLockupProps = {
  /** Optional supporting line under the wordmark, e.g. "Focused task manager". */
  tagline?: string;
};

/**
 * Horizontal lockup: the mark in its primary tile beside the "Janus" wordmark,
 * with an optional tagline. Mirrors the Board Manager header so it can be reused
 * anywhere a full signature is wanted.
 */
export function JanusLockup({ tagline }: JanusLockupProps): JSX.Element {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
        <JanusMark className="h-6 w-6" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-display text-lg tracking-tight">Janus</span>
        {tagline ? (
          <span className="block truncate text-[11px] font-medium text-muted-foreground">
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
