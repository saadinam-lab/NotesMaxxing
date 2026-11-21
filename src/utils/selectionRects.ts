import type { NormalizedRect } from '../types';

export function extractNormalizedRectsFromRange(
  range: Range,
  pageElement: HTMLElement,
): NormalizedRect[] {
  const pageBox = pageElement.getBoundingClientRect();
  if (pageBox.width <= 0 || pageBox.height <= 0) return [];

  const clientRects = Array.from(range.getClientRects());
  const raw: NormalizedRect[] = [];

  for (const r of clientRects) {
    if (r.width < 2 || r.height < 2) continue;

    // Clamp to page boundaries
    const left = Math.max(pageBox.left, r.left);
    const right = Math.min(pageBox.right, r.right);
    const top = Math.max(pageBox.top, r.top);
    const bottom = Math.min(pageBox.bottom, r.bottom);

    if (right - left < 2 || bottom - top < 2) continue;

    raw.push({
      x: (left - pageBox.left) / pageBox.width,
      y: (top - pageBox.top) / pageBox.height,
      width: (right - left) / pageBox.width,
      height: (bottom - top) / pageBox.height,
    });
  }

  return mergeLineRects(raw);
}

function mergeLineRects(rects: NormalizedRect[]): NormalizedRect[] {
  if (rects.length <= 1) return rects;

  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: NormalizedRect[] = [];

  for (const curr of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...curr });
      continue;
    }

    const prevBottom = prev.y + prev.height;
    const currBottom = curr.y + curr.height;
    const overlapY = Math.min(prevBottom, currBottom) - Math.max(prev.y, curr.y);
    const minH = Math.min(prev.height, curr.height);

    const sameLine = minH > 0 && overlapY / minH >= 0.45;
    const prevRight = prev.x + prev.width;
    const currRight = curr.x + curr.width;
    const horizontalGap = curr.x - prevRight;

    if (sameLine && horizontalGap <= 0.014 && currRight >= prev.x - 0.01) {
      const nextX = Math.min(prev.x, curr.x);
      const nextY = Math.min(prev.y, curr.y);
      const nextRight = Math.max(prevRight, currRight);
      const nextBottom = Math.max(prevBottom, currBottom);
      prev.x = nextX;
      prev.y = nextY;
      prev.width = nextRight - nextX;
      prev.height = nextBottom - nextY;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}
