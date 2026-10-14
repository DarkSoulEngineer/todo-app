"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Keyboard, Layers, Pin, X, type LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/common/theme-toggle";
import type { TaskStats } from "@/lib/domain/tasks-selectors";
import { cn } from "@/lib/utils/utils";

interface SidebarProps {
  /** Keeps layout animations unique between the desktop and mobile instances. */
  idPrefix: string;
  stats: TaskStats;
  /** Name of the board selected in the board manager, shown as the home row's secondary line. */
  currentBoardName?: string;
  /** Desktop only: the sidebar stays open once pinned, regardless of hover. */
  pinned: boolean;
  onTogglePin: () => void;
  onShowHelp: () => void;
  onClose?: () => void;
}

/**
 * Overlay sidebar:
 * - Fully hidden by default (slides off-screen to the left)
 * - Reveals on hover over the thin handle at the left edge, or while pinned
 * - A pin button in the header keeps it open without hovering
 * - The mobile version (inside the drawer) is always expanded and never pinned
 */
export function Sidebar({
  idPrefix,
  stats,
  currentBoardName,
  pinned,
  onTogglePin,
  onShowHelp,
  onClose,
}: SidebarProps) {
  const isMobile = typeof onClose === "function";
  const [hovered, setHovered] = useState(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover handling with a small delay so the panel does not flicker when the
  // pointer crosses the edge.
  const handleMouseEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (!expandTimerRef.current) {
      expandTimerRef.current = setTimeout(() => {
        expandTimerRef.current = null;
        setHovered(true);
      }, 120);
    }
  };

  const handleMouseLeave = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    if (!collapseTimerRef.current) {
      collapseTimerRef.current = setTimeout(() => {
        collapseTimerRef.current = null;
        setHovered(false);
      }, 250);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // The board manager is its own route (the app's landing page), so its active
  // state comes from the pathname rather than from the in-page view mode.
  const pathname = usePathname();
  const onBoardManager = pathname === "/";
  const boardName = currentBoardName?.trim();
  const open = isMobile || pinned || hovered;

  return (
    <>
      {/* Hover target: a thin strip at the left edge reveals the sidebar. */}
      {!isMobile && !pinned ? (
        <div
          aria-hidden="true"
          onMouseEnter={handleMouseEnter}
          className="group fixed inset-y-0 left-0 z-30 hidden w-2 lg:block"
        >
          <span className="absolute top-1/2 left-0 h-16 w-1 -translate-y-1/2 rounded-r-full bg-border opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
      ) : null}

      <aside
        onMouseEnter={isMobile ? undefined : handleMouseEnter}
        onMouseLeave={isMobile ? undefined : handleMouseLeave}
        inert={!isMobile && !open ? true : undefined}
        className={cn(
          "flex flex-col border-r border-border bg-card/70 backdrop-blur-sm",
          isMobile
            ? "h-full"
            : pinned
              ? "relative h-full w-[16rem]"
              : cn(
                  "fixed inset-y-0 left-0 z-40 w-[16rem] transition-transform duration-200 ease-out",
                  open ? "translate-x-0 shadow-2xl" : "pointer-events-none -translate-x-full",
                ),
        )}
      >
        <div className="flex items-center gap-2.5 px-3 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15">
            <Check className="h-[18px] w-[18px]" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-xl tracking-tight">Stride</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              Focused task manager
            </p>
          </div>
          {!isMobile ? (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
              title={pinned ? "Unpin sidebar" : "Pin sidebar"}
              className={cn(
                "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                pinned
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Pin className={cn("h-4 w-4", pinned && "fill-current")} />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto px-2 pb-3">
          {/* Home row — the board manager is its own route, not an in-page view. */}
          <div className="space-y-0.5">
            <NavItem
              icon={Layers}
              label="Board manager"
              secondary={boardName}
              href="/"
              active={onBoardManager}
              layoutId={`${idPrefix}-home-pill`}
            />
          </div>
        </nav>

        <div className="border-t border-border px-3 py-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground tabular-nums">
              {Math.round(stats.completionRate * 100)}%
            </span>
          </div>
          <Progress value={stats.completionRate} label="Overall completion" />
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {stats.completed}/{stats.total} done · {stats.active} open
          </p>

          <div className="mt-3 flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              onClick={onShowHelp}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  /** Optional secondary line under the label (expanded state only). */
  secondary?: string;
  active: boolean;
  layoutId?: string;
  /** When set the row navigates instead of acting in place, so `onClick` is unnecessary. */
  href?: string;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, secondary, active, layoutId, href, onClick }: NavItemProps) {
  const reduceMotion = useReducedMotion();
  const shared = {
    "aria-current": active ? ("page" as const) : undefined,
    className: cn(
      "focus-ring relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
      secondary && "items-start",
      active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    ),
  };

  const row = (
    <>
      {active && layoutId ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <Icon
        className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-primary")}
        strokeWidth={2.2}
      />
      <span className="relative flex-1 text-left">
        <span className="block truncate">{label}</span>
        {secondary ? (
          <span className="block truncate text-xs font-normal text-muted-foreground">{secondary}</span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} {...shared}>
        {row}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} {...shared}>
      {row}
    </button>
  );
}
