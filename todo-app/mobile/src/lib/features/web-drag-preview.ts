/** Clone the rendered card, including expanded checklists and scroll positions. */
export function createWebDragPreview(content: HTMLElement, rect: DOMRect): HTMLElement {
  const preview = content.cloneNode(true) as HTMLElement;
  preview.removeAttribute("id");
  preview.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  preview.querySelectorAll("[data-testid]").forEach((node) => node.removeAttribute("data-testid"));
  preview.setAttribute("aria-hidden", "true");
  preview.setAttribute("inert", "");
  preview.dataset.dragPreview = "true";
  const computed = getComputedStyle(content);
  Object.assign(preview.style, {
    position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    margin: "0", boxSizing: "border-box", pointerEvents: "none", zIndex: "10000", opacity: "0.95",
    fontFamily: computed.fontFamily, color: computed.color, willChange: "transform", overflow: "hidden",
    filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.25))",
  });
  document.body.appendChild(preview);
  const originals = [content, ...content.querySelectorAll<HTMLElement>("*")];
  const copies = [preview, ...preview.querySelectorAll<HTMLElement>("*")];
  originals.forEach((node, index) => { copies[index].scrollTop = node.scrollTop; copies[index].scrollLeft = node.scrollLeft; });
  return preview;
}

function edgeSpeed(point: number, start: number, end: number) {
  const threshold = Math.min(40, (end - start) / 3);
  if (point < start || point > end) return 0;
  if (point < start + threshold) return -Math.ceil(14 * (1 - (point - start) / threshold));
  if (point > end - threshold) return Math.ceil(14 * (1 - (end - point) / threshold));
  return 0;
}

/** Called each animation frame, even when the pointer pauses at an edge. */
export function scrollJanusAtPointer(source: HTMLElement, x: number, y: number) {
  const carousel = source.closest<HTMLElement>('[data-testid="janus-carousel"]');
  if (!carousel) return;
  const bounds = carousel.getBoundingClientRect();
  if (y < bounds.top || y > bounds.bottom) return;
  carousel.scrollLeft += edgeSpeed(x, bounds.left, bounds.right);
  for (const list of carousel.querySelectorAll<HTMLElement>('[data-testid^="janus-column-scroll-"]')) {
    const rect = list.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y <= rect.bottom + 44) list.scrollTop += edgeSpeed(Math.min(y, rect.bottom), rect.top, rect.bottom);
  }
}
