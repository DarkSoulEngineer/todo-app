/** Keep cards usable while allowing Home to fill tablets and desktop windows. */
export function getHomeLayout(width: number, leftInset = 0, rightInset = 0) {
  const available = Math.max(0, width - leftInset - rightInset);
  const wide = available >= 768;
  const padding = wide ? 24 : 12;
  const contentWidth = Math.max(0, available - padding * 2);
  const sidebar = available >= 1200;
  const statsWidth = sidebar ? Math.min(440, Math.max(360, Math.round(contentWidth * 0.28))) : 0;
  const boardWidth = contentWidth - (sidebar ? statsWidth + 24 : 0);
  const columns = wide ? Math.min(3, Math.max(2, Math.floor((boardWidth + 16) / (340 + 16)))) : 1;
  return { wide, sidebar, statsWidth, padding, columns, cardWidth: Math.max(0, (boardWidth - (columns - 1) * 16) / columns) };
}
