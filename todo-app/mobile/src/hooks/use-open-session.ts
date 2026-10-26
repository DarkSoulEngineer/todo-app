import { useEffect, useRef, useState } from "react";

/** Increments when a modal opens so its form remounts with fresh state. */
export function useOpenSession(visible: boolean) {
  const [session, setSession] = useState(0);
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Resetting here keeps the previous form mounted through its exit animation.
      setSession((value) => value + 1);
    }
    wasVisible.current = visible;
  }, [visible]);

  return session;
}
