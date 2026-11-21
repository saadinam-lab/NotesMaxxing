import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, HelpCircle, Highlighter, MousePointer2, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function HelpGuideButton() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="fixed bottom-4 left-4 z-35 sm:bottom-6 sm:left-6">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="nm-glass-popover mb-3 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border p-4 text-left sm:w-[376px]"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} strokeWidth={1.75} className="text-[var(--nm-accent)]" />
                <h2 className="nm-heading text-[15px] font-semibold text-[var(--nm-text)]">
                  Quick Study Guide
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="nm-btn-ghost flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
                aria-label="Close guide"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-3 text-[13px] leading-[1.55]">
              <div className="flex items-start gap-2.5">
                <MousePointer2
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[var(--nm-accent)]"
                />
                <div>
                  <div className="font-semibold text-[var(--nm-text)]">
                    Read Mode <kbd className="font-mono-num ml-1 text-[11px] opacity-70">V</kbd>
                  </div>
                  <p className="text-[var(--nm-text-muted)]">
                    Read smoothly, select & copy text word-by-word, and click existing highlights to open notes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Highlighter
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[var(--nm-accent)]"
                />
                <div>
                  <div className="font-semibold text-[var(--nm-text)]">
                    Notes Mode <kbd className="font-mono-num ml-1 text-[11px] opacity-70">N</kbd>
                  </div>
                  <p className="text-[var(--nm-text-muted)]">
                    Drag across text to highlight, click <strong>Add Note</strong>, write Markdown, paste YouTube links for video cards, or paste (<kbd className="font-mono-num text-[11px]">Ctrl+V</kbd>) handwritten photos. Hover underlined highlights to preview.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CircleDot
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-[var(--nm-accent)]"
                />
                <div>
                  <div className="font-semibold text-[var(--nm-text)]">
                    Circle Mode <kbd className="font-mono-num ml-1 text-[11px] opacity-70">C</kbd>
                  </div>
                  <p className="text-[var(--nm-text-muted)]">
                    Freehand pen or circle formulas and diagrams with color picker, eraser, and Undo/Redo (<kbd className="font-mono-num text-[11px]">Ctrl+Z</kbd>).
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--nm-border)] pt-2.5 text-[12px] text-[var(--nm-text-muted)]">
                <strong className="text-[var(--nm-text)]">Quick Tips:</strong> Press{' '}
                <kbd className="font-mono-num rounded bg-[var(--nm-surface-subtle)] px-1 py-0.5 text-[11px]">
                  D
                </kbd>{' '}
                for Dark/Light mode. Everything auto-saves locally to your Library; use{' '}
                <strong>Save Local (.notesmax)</strong> to back up or share PDFs with all notes intact.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Study Guide & Shortcuts"
        title="Study Guide (?)"
        style={
          isOpen
            ? {
                borderColor: 'var(--nm-accent)',
                color: 'var(--nm-accent)',
              }
            : undefined
        }
        className="nm-glass-popover nm-btn-ghost flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-[var(--nm-text-muted)]"
      >
        <HelpCircle size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
