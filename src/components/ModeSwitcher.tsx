import { motion } from 'framer-motion';
import { CircleDot, Highlighter, MousePointer2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StudyMode } from '../types';

interface ModeSwitcherProps {
  mode: StudyMode;
  onChangeMode: (mode: StudyMode) => void;
}

interface SegmentMetrics {
  left: number;
  width: number;
}

const MODES: { id: StudyMode; label: string; shortcut: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Read', shortcut: 'V', icon: MousePointer2 },
  { id: 'notes', label: 'Notes', shortcut: 'N', icon: Highlighter },
  { id: 'draw', label: 'Circle', shortcut: 'C', icon: CircleDot },
];

const BOUNCY_SNAP_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 18,
  mass: 0.85,
};

const DRAG_TRACK_SPRING = {
  type: 'spring' as const,
  stiffness: 950,
  damping: 46,
  mass: 0.28,
};

export function ModeSwitcher({ mode, onChangeMode }: ModeSwitcherProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<StudyMode, HTMLButtonElement | null>>({
    select: null,
    notes: null,
    draw: null,
  });

  const [metrics, setMetrics] = useState<Record<StudyMode, SegmentMetrics>>({
    select: { left: 4, width: 84 },
    notes: { left: 88, width: 90 },
    draw: { left: 178, width: 88 },
  });
  const [trackWidth, setTrackWidth] = useState(270);

  const [isHolding, setIsHolding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [hoveredMode, setHoveredMode] = useState<StudyMode | null>(null);

  const dragMetaRef = useRef<{
    startClientX: number;
    startPillLeft: number;
    pillWidth: number;
    didMove: boolean;
    pressedTargetMode: StudyMode;
  } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next: Partial<Record<StudyMode, SegmentMetrics>> = {};
    for (const m of MODES) {
      const btn = buttonRefs.current[m.id];
      if (btn) {
        next[m.id] = {
          left: btn.offsetLeft,
          width: btn.offsetWidth,
        };
      }
    }
    if (next.select && next.notes && next.draw) {
      setMetrics(next as Record<StudyMode, SegmentMetrics>);
      setTrackWidth(track.clientWidth);
    }
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const findNearestMode = useCallback(
    (pillCenterX: number): StudyMode => {
      let best: StudyMode = mode;
      let bestDist = Infinity;
      for (const m of MODES) {
        const seg = metrics[m.id];
        const center = seg.left + seg.width / 2;
        const dist = Math.abs(pillCenterX - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = m.id;
        }
      }
      return best;
    },
    [metrics, mode],
  );

  const modeFromClientX = useCallback(
    (clientX: number): StudyMode => {
      const track = trackRef.current;
      if (!track) return mode;
      const rect = track.getBoundingClientRect();
      const relX = clientX - rect.left;
      return findNearestMode(relX);
    },
    [findNearestMode, mode],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;

    track.setPointerCapture(e.pointerId);
    const activeSeg = metrics[mode];
    const pressedTargetMode = modeFromClientX(e.clientX);

    dragMetaRef.current = {
      startClientX: e.clientX,
      startPillLeft: activeSeg.left,
      pillWidth: activeSeg.width,
      didMove: false,
      pressedTargetMode,
    };

    setIsHolding(true);
    setDragWidth(activeSeg.width);
    setHoveredMode(pressedTargetMode);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const meta = dragMetaRef.current;
    if (!meta) return;

    const deltaX = e.clientX - meta.startClientX;
    if (!meta.didMove && Math.abs(deltaX) > 4) {
      meta.didMove = true;
      setIsDragging(true);
    }

    if (meta.didMove) {
      const minLeft = 4;
      const maxLeft = Math.max(minLeft, trackWidth - meta.pillWidth - 4);
      const clampedLeft = Math.min(maxLeft, Math.max(minLeft, meta.startPillLeft + deltaX));
      setDragLeft(clampedLeft);
      setHoveredMode(findNearestMode(clampedLeft + meta.pillWidth / 2));
    }
  };

  const finishInteraction = (e: React.PointerEvent<HTMLDivElement>) => {
    const meta = dragMetaRef.current;
    if (!meta) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was already released
    }

    if (meta.didMove && dragLeft !== null) {
      const target = findNearestMode(dragLeft + meta.pillWidth / 2);
      onChangeMode(target);
    } else {
      onChangeMode(meta.pressedTargetMode);
    }

    dragMetaRef.current = null;
    setIsHolding(false);
    setIsDragging(false);
    setDragLeft(null);
    setDragWidth(null);
    setHoveredMode(null);
  };

  const activeSeg = metrics[mode];
  const pillLeft = isDragging && dragLeft !== null ? dragLeft : activeSeg.left;
  const pillWidth = isDragging && dragWidth !== null ? dragWidth : activeSeg.width;
  const displayMode = isDragging && hoveredMode ? hoveredMode : mode;

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label="Study Mode"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
      className="nm-recessed relative flex touch-none select-none items-center rounded-full p-1"
    >
      {/* Draggable, lifting, extra-bouncy Liquid Glass pill (pointer-events: none) */}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          x: pillLeft,
          width: pillWidth,
          scale: isHolding ? 1.09 : 1,
          boxShadow: isHolding
            ? 'inset 0 1px 0 rgba(255, 255, 255, 0.58), 0 10px 24px rgba(0, 0, 0, 0.28)'
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 1px 4px rgba(0, 0, 0, 0.12)',
        }}
        transition={isDragging ? DRAG_TRACK_SPRING : BOUNCY_SNAP_SPRING}
        style={{
          left: 0,
          backgroundColor: 'var(--nm-accent)',
          opacity: isHolding ? 0.94 : 1,
        }}
        className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-full"
      />

      {MODES.map((m) => {
        const Icon = m.icon;
        const active = displayMode === m.id;
        return (
          <button
            key={m.id}
            ref={(el) => {
              buttonRefs.current[m.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChangeMode(m.id);
              }
            }}
            title={`${m.label} Mode (${m.shortcut}) — Click or drag`}
            className={`relative z-10 flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors duration-150 ${
              active
                ? 'text-[var(--nm-accent-fg)]'
                : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden sm:inline">{m.label}</span>
            <kbd
              className={`hidden font-mono-num text-[11px] lg:inline ${
                active ? 'opacity-80' : 'opacity-60'
              }`}
            >
              {m.shortcut}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
