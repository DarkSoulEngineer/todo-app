"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/utils";

interface CompleteToggleProps {
  completed: boolean;
  canceled: boolean;
  onToggle: () => void;
  className?: string;
}

const PARTICLE_COUNT = 8;

export function CompleteToggle({ completed, canceled, onToggle, className }: CompleteToggleProps) {
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wasCompleted = useRef(completed);

  useEffect(() => {
    if (completed && !wasCompleted.current && !reduceMotion) {
      setBurst(true);
      const timer = window.setTimeout(() => setBurst(false), 620);
      wasCompleted.current = completed;
      return () => window.clearTimeout(timer);
    }
    wasCompleted.current = completed;
  }, [completed, reduceMotion]);

  // When completed, show X on hover with smooth transition
  const showUndoIcon = completed && isHovered;

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-pressed={completed}
      aria-label={completed ? "Mark incomplete (undo)" : "Mark as completed"}
      className={cn(
        // 28px touch target, rounded-lg pill shape (distinct from SelectToggle's rounded-xl square).
        "focus-ring group/toggle relative grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition-all duration-200 active:scale-95",
        completed
          ? "border-success bg-success text-white ring-4 ring-success/15"
          : canceled
            ? "border-slate-400/60 text-slate-400 hover:border-slate-400"
            : "border-muted-foreground/40 text-transparent hover:border-primary hover:bg-primary/5 hover:ring-4 hover:ring-primary/10",
        className,
      )}
    >
      <AnimatePresence>
        {burst ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
            {Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
              const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
              return (
                <motion.span
                  key={index}
                  className="absolute h-1 w-1 rounded-full bg-success"
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{
                    opacity: 0,
                    x: Math.cos(angle) * 20,
                    y: Math.sin(angle) * 20,
                    scale: 0.3,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              );
            })}
          </span>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {completed ? (
          // When completed: show checkmark normally, X on hover
          showUndoIcon ? (
            <motion.svg
              key="x"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { scale: 0.4, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.4, rotate: 90 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <motion.path
                d="M18 6L6 18M6 6l12 12"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="check"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5, rotate: 90 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <motion.path
                d="M5 13l4 4L19 7"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            </motion.svg>
          )
        ) : canceled ? (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93a10 10 0 0 1 14.14 14.14" />
          </svg>
        ) : (
          <Check
            className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover/toggle:opacity-60"
            strokeWidth={3.2}
          />
        )}
      </AnimatePresence>

      {/* Subtle "Undo" tooltip on hover when completed */}
      {completed && (
        <span
          className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-muted/95 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-border opacity-0 transition-opacity group-hover/toggle:opacity-100 backdrop-blur-sm"
          aria-hidden="true"
        >
          Undo
        </span>
      )}
    </button>
  );
}