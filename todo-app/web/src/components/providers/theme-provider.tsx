"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme provider (next-themes 0.4.6).
 *
 * next-themes is unmaintained upstream, and React 19 warns on any `<script>`
 * element it *creates* on the client ("Encountered a script tag while rendering
 * React component…"). There is no fixed version to upgrade to.
 *
 * Two-part fix:
 * - SSR the provider normally (this client component is pre-rendered into the
 *   initial HTML), so the anti-FOUC inline theme script is streamed and runs
 *   before first paint. `suppressHydrationWarning` on `<html>` (layout.tsx)
 *   is next-themes' documented companion for this.
 * - Pass `scriptProps` with a non-executable `type` on the client only. React
 *   exempts data blocks from the script-tag warning, so any client-side render
 *   or remount of the provider stays silent, while the server still emits a
 *   real, executable script. On the rare hydration patch the attribute lands
 *   after the script already ran, so FOUC prevention is unaffected.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  const scriptProps =
    typeof window === "undefined"
      ? undefined
      : ({ type: "application/json" } as const);

  return <NextThemesProvider {...props} scriptProps={scriptProps} />;
}