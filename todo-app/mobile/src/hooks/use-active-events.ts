import { useEffect, useState } from "react";
import { getActiveEventThemes, getEventOverride, subscribeToEvents } from "@/lib/features/active-events";

export function useActiveEvents() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const unsubscribe = subscribeToEvents(refresh);
    // Also refresh an editor left open across midnight or a suspended session.
    const timer = setInterval(refresh, 30_000);
    refresh();
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  const override = getEventOverride();
  return { events: getActiveEventThemes(now, override), override };
}
