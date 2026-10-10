"use client";

import { useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  const [mounted, setMounted] = useState(false);

  if (typeof window !== "undefined") {
    setMounted(true);
  }

  if (!mounted) {
    return <>{props.children}</>;
  }

  return <NextThemesProvider {...props} />;
}
