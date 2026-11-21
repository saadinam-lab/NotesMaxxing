import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Link2, StickyNote, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HIGHLIGHT_COLORS, type HighlightAnnotation, type HighlightColor } from '../types';

export interface PopoverAnchor {
  highlight: HighlightAnnotation;
  /** Viewport client rect of the first highlight box */
  anchorRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

interface HighlightPopoverPortalProps {
  floatingAnchor: PopoverAnchor | null;
  hoverAnchor: PopoverAnchor | null;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onOpenNote: (highlightId: string) => void;
  onChangeColor: (highlightId: string, color: HighlightColor) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onDismissFloating: () => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'mint', 'coral', 'sage'];

const SPRING_COLOR = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 22,
  mass: 0.8,
};

function computeIntegerCoords(
  anchorRect: PopoverAnchor['anchorRect'],
  popoverWidth: number,
  popoverHeight: number,
): { left: number; top: number; placedBelow: boolean } {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const rawLeft = Math.round(centerX - popoverWidth / 2);
  const maxLeft = Math.max(12, window.innerWidth - popoverWidth - 12);
  const left = Math.min(maxLeft, Math.max(12, rawLeft));

  const spaceAbove = anchorRect.top - 64;
  const placedBelow = spaceAbove < popoverHeight + 12;
  const top = placedBelow
    ? Math.round(anchorRect.top + anchorRect.height + 8)
    : Math.round(anchorRect.top - popoverHeight - 10);

  return { left, top, placedBelow };
}

export function HighlightPopoverPortal({
  floatingAnchor,
  hoverAnchor,
  onHoverEnter,
  onHoverLeave,
  onOpenNote,
  onChangeColor,
  onDeleteHighlight,
  onDismissFloating,
}: HighlightPopoverPortalProps) {
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<HTMLDivElement | null>(null);

  const [floatingPos, setFloatingPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [hoverPos, setHoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!floatingAnchor || !floatingRef.current) return;
    const w = floatingRef.current.offsetWidth || 240;
    const h = floatingRef.current.offsetHeight || 42;
    const pos = computeIntegerCoords(floatingAnchor.anchorRect, w, h);
    setFloatingPos({ left: pos.left, top: pos.top });
  }, [floatingAnchor]);

  useLayoutEffect(() => {
    if (!hoverAnchor || !hoverRef.current) return;
    const w = hoverRef.current.offsetWidth || 240;
    const h = hoverRef.current.offsetHeight || 38;
    const pos = computeIntegerCoords(hoverAnchor.anchorRect, w, h);
    setHoverPos({ left: pos.left, top: pos.top });
  }, [hoverAnchor]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Hover Preview Pill for noted highlights */}
      <AnimatePresence>
        {hoverAnchor && !floatingAnchor && (
          <motion.div
            key={`hover-${hoverAnchor.highlight.id}`}
            ref={hoverRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{
              left: hoverPos.left,
              top: hoverPos.top,
            }}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote(hoverAnchor.highlight.id);
            }}
            className="nm-glass-popover fixed z-50 flex max-w-[300px] cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2"
          >
            <div className="min-w-0 flex-1">
              {hoverAnchor.highlight.noteText.trim() ? (
                <p className="truncate text-[13px] font-medium text-[var(--nm-text)]">
                  {hoverAnchor.highlight.noteText.trim()}
                </p>
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-[var(--nm-text-muted)]">
                  {hoverAnchor.highlight.links.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Link2 size={16} strokeWidth={1.75} className="text-[var(--nm-accent)]" />
                      <span>
                        {hoverAnchor.highlight.links.length} link
                        {hoverAnchor.highlight.links.length > 1 ? 's' : ''}
                      </span>
                    </span>
                  )}
                  {hoverAnchor.highlight.images.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon size={16} strokeWidth={1.75} className="text-[var(--nm-accent)]" />
                      <span>{hoverAnchor.highlight.images.length} img</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <span
              style={{
                backgroundColor: 'var(--nm-accent-soft)',
                color: 'var(--nm-accent)',
              }}
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
            >
              Open Note
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immediate Floating Action Pill after creating a highlight in Notes Mode */}
      <AnimatePresence>
        {floatingAnchor && (
          <motion.div
            key={`float-${floatingAnchor.highlight.id}`}
            ref={floatingRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              left: floatingPos.left,
              top: floatingPos.top,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="nm-glass-popover fixed z-50 flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5"
          >
            <div className="flex items-center gap-1.5 pr-1">
              {COLOR_ORDER.map((c) => {
                const cSpec = HIGHLIGHT_COLORS[c];
                const selected = floatingAnchor.highlight.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChangeColor(floatingAnchor.highlight.id, c)}
                    className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
                    title={cSpec.label}
                    aria-label={`Highlight color ${cSpec.label}`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="activeFloatingColorRing"
                        transition={SPRING_COLOR}
                        className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--nm-accent)]"
                      />
                    )}
                    <span
                      className="relative z-10 h-3.5 w-3.5 rounded-full border border-black/15"
                      style={{ backgroundColor: cSpec.swatch }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-[var(--nm-border)]" />

            <button
              type="button"
              onClick={() => {
                onDismissFloating();
                onOpenNote(floatingAnchor.highlight.id);
              }}
              style={{
                backgroundColor: 'var(--nm-accent)',
                color: 'var(--nm-accent-fg)',
              }}
              className="inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-opacity duration-150 hover:opacity-90"
            >
              <StickyNote size={16} strokeWidth={1.75} />
              <span>
                {floatingAnchor.highlight.noteText.trim().length > 0 ||
                floatingAnchor.highlight.links.length > 0 ||
                floatingAnchor.highlight.images.length > 0
                  ? 'Open Note'
                  : 'Add Note'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDeleteHighlight(floatingAnchor.highlight.id)}
              className="flex min-h-[30px] min-w-[30px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] transition-colors duration-150 hover:bg-rose-500/15 hover:text-rose-400"
              title="Remove highlight"
              aria-label="Remove highlight"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
