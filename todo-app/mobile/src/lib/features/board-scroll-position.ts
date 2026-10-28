interface Column { id: string; title: string }
export interface BoardScrollStop extends Column { offset: number }

/** Only distinct, reachable scroll positions get markers (including Add list). */
export function getBoardScrollPosition(columns: Column[], interval: number, viewport: number, content: number, offset: number) {
  const max = Math.max(0, content - viewport);
  const stops: BoardScrollStop[] = [];
  if (viewport > 0 && max > 1) {
    for (const [index, column] of [...columns, { id: "__add-list", title: "Add list" }].entries()) {
      const stop = { ...column, offset: Math.min(index * interval, max) };
      if (stops.at(-1)?.offset === stop.offset) stops[stops.length - 1] = stop;
      else stops.push(stop);
    }
  }
  const x = Math.max(0, Math.min(offset, max));
  let activeIndex = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i].offset - x) < Math.abs(stops[activeIndex].offset - x)) activeIndex = i;
  }
  return { stops, activeIndex, canLeft: x > 1, canRight: x < max - 1 };
}
