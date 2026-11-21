import { HIGHLIGHT_COLORS, type HighlightAnnotation } from '../types';

interface HighlightOverlayProps {
  highlights: HighlightAnnotation[];
  isDark: boolean;
  activeHighlightId: string | null;
  flashingHighlightId: string | null;
}

export function HighlightOverlay({
  highlights,
  isDark,
  activeHighlightId,
  flashingHighlightId,
}: HighlightOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {highlights.map((h) => {
        if (h.rects.length === 0) return null;
        const spec = HIGHLIGHT_COLORS[h.color] ?? HIGHLIGHT_COLORS.yellow;
        const underlineColor =
          h.color === 'yellow'
            ? isDark
              ? '#F59E0B'
              : '#C2410C'
            : spec.underline;
        const hasNotes =
          h.noteText.trim().length > 0 || h.links.length > 0 || h.images.length > 0;
        const isActive = activeHighlightId === h.id;
        const isFlashing = flashingHighlightId === h.id;

        return (
          <div key={h.id} className="pointer-events-none">
            {h.rects.map((r, idx) => {
              const isLast = idx === h.rects.length - 1;
              return (
                <div
                  key={`${h.id}-${idx}`}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                    backgroundColor: isDark ? spec.fillDark : spec.fill,
                    borderBottom: hasNotes ? `2px solid ${underlineColor}` : undefined,
                  }}
                  className={`pointer-events-none absolute rounded-[3px] ${
                    isActive ? 'ring-1 ring-[var(--nm-accent)]' : ''
                  } ${isFlashing ? 'animate-highlight-pulse' : ''}`}
                >
                  {hasNotes && isLast && (
                    <span
                      style={{ backgroundColor: underlineColor }}
                      className="pointer-events-none absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2 ring-[var(--nm-surface)]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
