"use client";

import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Hash,
  LayoutGrid,
  SlidersHorizontal,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { STATUS_META } from "@/components/common/status-meta";
import { getBoardColorByLabel } from "@/lib/domain/boards";
import { getCategory } from "@/lib/domain/categories";
import type { BoardSection } from "@/lib/domain/types";
import { cn } from "@/lib/utils/utils";

export interface CategoryCount {
  id: string;
  count: number;
}

export interface FilterMenuSections {
  /** Focused section id, or null for the whole board. */
  activeId: string | null;
  /** Board columns, in board order (hidden ones are filtered out by the caller). */
  items: BoardSection[];
  counts: Record<string, number>;
  onSelect: (id: string | null) => void;
}

export interface FilterMenuCategories {
  activeId: string | "all";
  counts: CategoryCount[];
  /** Built-in categories the user deleted, offered as a restore action. */
  deleted: string[];
  onSelect: (id: string | "all") => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
}

export interface FilterMenuProps {
  /** Board column filter; omit to hide the group. */
  sections?: FilterMenuSections;
  /** Category filter; omit to hide the group. */
  categories?: FilterMenuCategories;
}

/**
 * On-screen filter control: a compact button that opens a popover of section
 * and/or category options. The sidebar no longer carries these, so each view
 * surfaces the groups it actually filters by (the board shows both).
 */
export function FilterMenu({ sections, categories }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Nothing to filter on (e.g. list/calendar with no categories) — render no control.
  if (!sections && !categories) return null;

  const activeCount =
    (sections && sections.activeId !== null ? 1 : 0) +
    (categories && categories.activeId !== "all" ? 1 : 0);

  function clearAll(): void {
    if (sections && sections.activeId !== null) sections.onSelect(null);
    if (categories && categories.activeId !== "all") categories.onSelect("all");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={activeCount > 0 ? `Filter (${activeCount} active)` : "Filter"}
        title="Filter"
        className={cn(
          "focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border bg-card/70 px-3 text-sm font-medium shadow-xs transition-colors",
          activeCount > 0
            ? "border-primary/50 text-foreground"
            : "border-input text-muted-foreground hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>Filter</span>
        {activeCount > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground tabular-nums">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <motion.div
          role="menu"
          aria-label="Filters"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="absolute left-0 z-30 mt-2 w-64 origin-top-left rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          {sections ? (
            <FilterGroup
              heading="Sections"
              allIcon={<LayoutGrid className="h-4 w-4" strokeWidth={2.2} />}
              allLabel="All sections"
              allActive={sections.activeId === null}
              onAll={() => sections.onSelect(null)}
            >
              {sections.items.map((section) => (
                <FilterRow
                  key={section.id}
                  icon={sectionIcon(section)}
                  label={section.title}
                  count={sections.counts[section.id] ?? 0}
                  active={sections.activeId === section.id}
                  onClick={() =>
                    sections.onSelect(sections.activeId === section.id ? null : section.id)
                  }
                />
              ))}
            </FilterGroup>
          ) : null}

          {sections && categories ? <div className="my-1 h-px bg-border" /> : null}

          {categories ? (
            <FilterGroup
              heading="Categories"
              allIcon={<Tag className="h-4 w-4" strokeWidth={2.2} />}
              allLabel="All categories"
              allActive={categories.activeId === "all"}
              onAll={() => categories.onSelect("all")}
            >
              {categories.counts.map((item) => {
                const info = getCategory(item.id);
                if (!info) return null;
                return (
                  <FilterRow
                    key={item.id}
                    icon={<span className={cn("h-2.5 w-2.5 rounded-full", info.dot)} aria-hidden="true" />}
                    label={info.label}
                    count={item.count}
                    active={categories.activeId === item.id}
                    onClick={() =>
                      categories.onSelect(categories.activeId === item.id ? "all" : item.id)
                    }
                    onDelete={() => categories.onDelete(item.id)}
                  />
                );
              })}
              {categories.deleted.length > 0 ? (
                <button
                  type="button"
                  onClick={categories.onRestore}
                  className="focus-ring mt-0.5 block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Restore deleted categories
                </button>
              ) : null}
            </FilterGroup>
          ) : null}

          {activeCount > 0 ? (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={clearAll}
                className="focus-ring block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear filters
              </button>
            </>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  heading,
  allIcon,
  allLabel,
  allActive,
  onAll,
  children,
}: {
  heading: string;
  allIcon: ReactNode;
  allLabel: string;
  allActive: boolean;
  onAll: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </p>
      <FilterRow icon={allIcon} label={allLabel} active={allActive} onClick={onAll} />
      {children}
    </>
  );
}

function FilterRow({
  icon,
  label,
  count,
  active,
  onClick,
  onDelete,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={onClick}
        className={cn(
          "focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors",
          active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className={cn("grid h-4 w-4 shrink-0 place-items-center", active && "text-primary")}>
          {icon}
        </span>
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
        ) : null}
        {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          title="Delete category"
          className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-60 transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Icon for a board column: status glyph, category colour dot, or a hash. */
export function sectionIcon(section: BoardSection): ReactNode {
  if (section.status) {
    const Icon: LucideIcon = STATUS_META[section.status].icon;
    return <Icon className="h-4 w-4" strokeWidth={2.2} />;
  }
  const color = getBoardColorByLabel(section.title);
  if (color) {
    return <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} aria-hidden="true" />;
  }
  return <Hash className="h-4 w-4" strokeWidth={2.2} />;
}
