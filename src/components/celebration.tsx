"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo } from "react";

const COLORS = ["#6C5CE7", "#22C55E", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444"];

/** Deterministic pseudo-random in [0, 1) so renders stay pure and stable. */
function jitter(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

interface Piece {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  color: string;
}

interface CelebrationProps {
  show: boolean;
  onDone: () => void;
}

/** Confetti burst + banner when every task is done or set aside. */
export function Celebration({ show, onDone }: CelebrationProps) {
  const reduceMotion = useReducedMotion();

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        id: index,
        left: jitter(index * 1.37 + 0.11) * 100,
        size: 6 + jitter(index * 2.11 + 0.53) * 8,
        delay: jitter(index * 3.71 + 0.29) * 0.35,
        duration: 1.9 + jitter(index * 4.13 + 0.71) * 1.4,
        drift: (jitter(index * 5.77 + 0.19) - 0.5) * 40,
        rotate: (jitter(index * 6.31 + 0.97) - 0.5) * 720,
        color: COLORS[index % COLORS.length],
      })),
    [],
  );

  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(onDone, 3400);
    return () => window.clearTimeout(timer);
  }, [show, onDone]);

  if (reduceMotion) return null;

  return (
    <>
      <span role="status" className="sr-only">
        {show ? "All tasks complete." : ""}
      </span>
      <AnimatePresence>
        {show ? (
          <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
            {pieces.map((piece) => (
              <motion.span
                key={piece.id}
                className="absolute top-0 block rounded-[2px]"
                style={{
                  left: `${piece.left}%`,
                  width: piece.size,
                  height: piece.size * 1.5,
                  backgroundColor: piece.color,
                }}
                initial={{ y: "-12vh", x: 0, opacity: 0, rotate: 0 }}
                animate={{
                  y: "112vh",
                  x: piece.drift,
                  opacity: [0, 1, 1, 0],
                  rotate: piece.rotate,
                }}
                transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
              />
            ))}

            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/95 px-5 py-2.5 shadow-xl backdrop-blur"
            >
              <span className="font-display text-lg tracking-tight">All clear! 🎉</span>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
