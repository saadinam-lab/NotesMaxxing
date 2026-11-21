import { motion } from 'framer-motion';
import { Circle, Eraser, PenTool, Redo2, Undo2 } from 'lucide-react';
import { DRAW_COLORS, DRAW_WIDTHS, type DrawTool } from '../types';

interface DrawSubBarProps {
  drawTool: DrawTool;
  onChangeDrawTool: (tool: DrawTool) => void;
  drawColor: string;
  onChangeDrawColor: (color: string) => void;
  drawWidth: number;
  onChangeDrawWidth: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isDark: boolean;
}

const SPRING_FLUID = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
  mass: 0.75,
};

export function DrawSubBar({
  drawTool,
  onChangeDrawTool,
  drawColor,
  onChangeDrawColor,
  drawWidth,
  onChangeDrawWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isDark,
}: DrawSubBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING_FLUID}
      className="nm-glass-popover pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-1.5"
    >
      {/* Tool switcher */}
      <div className="nm-recessed flex items-center gap-0.5 rounded-full p-0.5">
        {(
          [
            { id: 'freehand', label: 'Pen', icon: PenTool, title: 'Freehand Pen' },
            { id: 'ellipse', label: 'Circle', icon: Circle, title: 'Smart Circle / Ellipse' },
            { id: 'eraser', label: 'Erase', icon: Eraser, title: 'Eraser (Click or drag over strokes)' },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = drawTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeDrawTool(t.id)}
              title={t.title}
              className={`relative flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 ${
                active
                  ? t.id === 'eraser'
                    ? 'text-white'
                    : 'text-[var(--nm-accent-fg)]'
                  : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="activeDrawToolPill"
                  transition={SPRING_FLUID}
                  className={`pointer-events-none absolute inset-0 rounded-full ${
                    t.id === 'eraser' ? 'bg-rose-500' : 'bg-[var(--nm-accent)]'
                  }`}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-[var(--nm-border)]" />

      {/* Color swatches with shared fluid layoutId ring */}
      <div className="flex items-center gap-2 px-1">
        {DRAW_COLORS.map((c) => {
          const displayColor =
            c.id === 'ink' ? (isDark ? '#F4F4F5' : '#1C1917') : c.value;
          const active =
            drawColor === c.value ||
            (c.id === 'ink' && (drawColor === '#F4F4F5' || drawColor === '#1C1917'));
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChangeDrawColor(c.id === 'ink' ? displayColor : c.value);
                if (drawTool === 'eraser') onChangeDrawTool('freehand');
              }}
              className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
              title={c.label}
              aria-label={`Stroke color ${c.label}`}
            >
              {active && (
                <motion.span
                  layoutId="activeDrawColorRing"
                  transition={SPRING_FLUID}
                  className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--nm-accent)]"
                />
              )}
              <span
                className="relative z-10 h-4 w-4 rounded-full border border-black/15"
                style={{ backgroundColor: displayColor }}
              />
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-[var(--nm-border)]" />

      {/* Stroke width */}
      <div className="flex items-center gap-1">
        {DRAW_WIDTHS.map((w, idx) => {
          const active = Math.abs(drawWidth - w.value) < 0.0005;
          const dotSize = idx === 0 ? 4 : idx === 1 ? 6.5 : 9.5;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onChangeDrawWidth(w.value)}
              className={`nm-btn-ghost flex h-8 w-8 cursor-pointer items-center justify-center rounded-full ${
                active
                  ? 'bg-[var(--nm-accent-soft)] text-[var(--nm-accent)] ring-1 ring-[var(--nm-accent)]/50'
                  : 'text-[var(--nm-text-muted)]'
              }`}
              title={`Stroke Width: ${w.label}`}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: dotSize, height: dotSize }}
              />
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-[var(--nm-border)]" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="nm-btn-ghost flex min-h-[34px] min-w-[34px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:pointer-events-none disabled:opacity-35"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className="nm-btn-ghost flex min-h-[34px] min-w-[34px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:pointer-events-none disabled:opacity-35"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
