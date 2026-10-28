/** Keep cards usable while allowing Home to fill tablets and desktop windows. */
export function getHomeLayout(width: number, leftInset = 0, rightInset = 0) {
  const available = Math.max(0, width - leftInset - rightInset);
  const wide = available >= 768;
  const padding = wide ? 24 : 12;
  const contentWidth = Math.max(0, available - padding * 2);
  // An equal split needs room for two usable cards in the left half.
  const sidebar = available >= 1320;
  const statsWidth = sidebar ? (contentWidth - 24) / 2 : 0;
  const boardWidth = contentWidth - (sidebar ? statsWidth + 24 : 0);
  const columns = wide ? 2 : 1;
  const statsChartSize = sidebar ? Math.min(360, Math.max(240, Math.round(statsWidth * 0.48))) : 200;
  return { wide, sidebar, statsWidth, statsChartSize, padding, columns, cardWidth: Math.max(0, (boardWidth - (columns - 1) * 16) / columns) };
}
