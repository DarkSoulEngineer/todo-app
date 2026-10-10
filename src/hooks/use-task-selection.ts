"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";

export interface TaskSelectionState {
  selectedIds: Set<string>;
  highlightedId: string | null;
  lastClickedId: string | null;
  selectMode: boolean;
}

export function useTaskSelection(
  visibleTasks: Task[],
  onSelectionChange?: (selectedIds: Set<string>) => void
) {
  const [state, setState] = useState<TaskSelectionState>({
    selectedIds: new Set(),
    highlightedId: null,
    lastClickedId: null,
    selectMode: false,
  });

  const visibleIdsRef = useRef<string[]>([]);
  
  // Update ref in an effect to avoid updating during render
  useEffect(() => {
    visibleIdsRef.current = visibleTasks.map((t) => t.id);
  }, [visibleTasks]);

  const isSelected = useCallback(
    (id: string) => state.selectedIds.has(id),
    [state.selectedIds]
  );

  const isHighlighted = useCallback(
    (id: string) => state.highlightedId === id,
    [state.highlightedId]
  );

  const toggleSelectMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectMode: !prev.selectMode,
      selectedIds: !prev.selectMode ? prev.selectedIds : new Set(),
      highlightedId: null,
      lastClickedId: null,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIds: new Set(),
      highlightedId: null,
      lastClickedId: null,
    }));
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  const selectAll = useCallback(() => {
    const allIds = new Set(visibleIdsRef.current);
    setState((prev) => ({
      ...prev,
      selectedIds: allIds,
      selectMode: true,
    }));
    onSelectionChange?.(allIds);
  }, [onSelectionChange]);

  const toggleTask = useCallback(
    (id: string, shiftKey = false) => {
      setState((prev) => {
        const newSelected = new Set(prev.selectedIds);
        const visibleIds = visibleIdsRef.current;

        if (shiftKey && prev.lastClickedId && visibleIds.includes(prev.lastClickedId)) {
          // Range selection
          const start = visibleIds.indexOf(prev.lastClickedId);
          const end = visibleIds.indexOf(id);
          const [from, to] = start <= end ? [start, end] : [end, start];
          for (let i = from; i <= to; i++) {
            newSelected.add(visibleIds[i]);
          }
        } else {
          // Single toggle
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
        }

        const nextSelectMode = newSelected.size > 0;
        return {
          ...prev,
          selectedIds: newSelected,
          highlightedId: id,
          lastClickedId: id,
          selectMode: nextSelectMode,
        };
      });
    },
    []
  );

  const setHighlighted = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, highlightedId: id }));
  }, []);

  const moveHighlight = useCallback((direction: "next" | "prev") => {
    setState((prev) => {
      const visibleIds = visibleIdsRef.current;
      if (visibleIds.length === 0) return prev;

      let currentIndex = -1;
      if (prev.highlightedId) {
        currentIndex = visibleIds.indexOf(prev.highlightedId);
      }

      let nextIndex: number;
      if (direction === "next") {
        nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
        if (nextIndex >= visibleIds.length) nextIndex = visibleIds.length - 1;
      } else {
        nextIndex = currentIndex >= 0 ? currentIndex - 1 : 0;
        if (nextIndex < 0) nextIndex = 0;
      }

      return {
        ...prev,
        highlightedId: visibleIds[nextIndex],
        selectMode: prev.selectMode || prev.selectedIds.size > 0,
      };
    });
  }, []);

  const selectHighlighted = useCallback(() => {
    setState((prev) => {
      if (!prev.highlightedId) return prev;
      const newSelected = new Set(prev.selectedIds);
      if (newSelected.has(prev.highlightedId)) {
        newSelected.delete(prev.highlightedId);
      } else {
        newSelected.add(prev.highlightedId);
      }
      return {
        ...prev,
        selectedIds: newSelected,
        lastClickedId: prev.highlightedId,
        selectMode: newSelected.size > 0,
      };
    });
  }, []);

  return {
    ...state,
    isSelected,
    isHighlighted,
    toggleSelectMode,
    clearSelection,
    selectAll,
    toggleTask,
    setHighlighted,
    moveHighlight,
    selectHighlighted,
  };
}