"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ban, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={completed}
      aria-label={completed ? "Mark as not completed" : "Mark as completed"}
      className={cn(
        // 28px: a comfortable touch target that still sits easily inside the
        // 17rem board columns. The circle shape is what tells this control
        // apart from the card's square selection checkbox.
        "focus-ring group/toggle relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90",
        completed
          ? // The success token keeps the "done" glow in step with the card's
            // status rail and the subtask checkboxes.
            "border-success bg-success text-white ring-4 ring-success/15"
          : canceled
            ? "border-slate-400/60 text-slate-400 hover:border-slate-400"
            : // A boundary you can actually see at rest, so the circle reads as
              // "complete this task" before anyone touches it.
              "border-muted-foreground/40 text-transparent hover:border-primary hover:bg-primary/5 hover:ring-4 hover:ring-primary/10",
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

      {completed ? (
        <motion.svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
        </motion.svg>
      ) : canceled ? (
        <Ban className="h-4 w-4" strokeWidth={2.6} />
      ) : (
        <Check
          className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover/toggle:opacity-60"
          strokeWidth={3.2}
        />
      )}
    </button>
  );
}
