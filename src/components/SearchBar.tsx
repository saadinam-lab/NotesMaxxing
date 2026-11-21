import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { SearchResult } from '../types';

interface SearchBarProps {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  activeIndex: number;
  isSearching: boolean;
  onChangeQuery: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const SPRING_FLUID = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
  mass: 0.75,
};

export function SearchBar({
  isOpen,
  query,
  results,
  activeIndex,
  isSearching,
  onChangeQuery,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING_FLUID}
          className="nm-glass-popover nm-surface-colors absolute top-3 right-4 z-35 flex items-center gap-2 rounded-2xl border px-3 py-1.5"
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--nm-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) onPrev();
                else onNext();
              }
            }}
            placeholder="Find in PDF..."
            className="w-44 bg-transparent text-[13px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)] focus:outline-none sm:w-56"
          />

          <span className="font-mono-num min-w-[54px] text-right text-[12px] text-[var(--nm-text-muted)]">
            {isSearching
              ? '...'
              : query.trim()
                ? results.length > 0
                  ? `${activeIndex + 1}/${results.length}`
                  : '0/0'
                : ''}
          </span>

          <div className="h-4 w-px bg-[var(--nm-border)]" />

          <button
            type="button"
            disabled={results.length === 0}
            onClick={onPrev}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:cursor-default disabled:opacity-35"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={results.length === 0}
            onClick={onNext}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:cursor-default disabled:opacity-35"
            title="Next match (Enter)"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
            title="Close search (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
