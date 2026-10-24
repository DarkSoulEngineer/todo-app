"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWindows, type WindowsApi } from "@/hooks/use-windows";

const WindowsContext = createContext<WindowsApi | null>(null);

export function WindowProvider({ children }: { children: ReactNode }) {
  const value = useWindows();
  return <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>;
}

export function useWindowsContext(): WindowsApi {
  const context = useContext(WindowsContext);
  if (!context) {
    throw new Error("useWindowsContext must be used within a WindowProvider");
  }
  return context;
}
