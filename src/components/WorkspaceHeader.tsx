import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Loader2,
  Minus,
  Moon,
  PanelRight,
  Plus,
  Save,
  Search,
  Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StudyMode, ThemeComfortSettings, ZoomMode } from '../types';
import { ModeSwitcher } from './ModeSwitcher';

interface WorkspaceHeaderProps {
  title: string;
  mode: StudyMode;
  onChangeMode: (mode: StudyMode) => void;
  currentPage: number;
  pageCount: number;
  onJumpToPage: (page: number) => void;
  scale: number;
  zoomMode: ZoomMode;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectZoomPreset: (mode: ZoomMode, presetScale?: number) => void;
  themeComfort: ThemeComfortSettings;
  onToggleTheme: (origin?: { x: number; y: number }) => void;
  onToggleDimImages: () => void;
  onToggleWarmSepia: () => void;
  onToggleSearch: () => void;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  noteBadgeCount: number;
  onSaveNotesMax: () => void;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onBackToLibrary: () => void;
}

export function WorkspaceHeader({
  title,
  mode,
  onChangeMode,
  currentPage,
  pageCount,
  onJumpToPage,
  scale,
  zoomMode,
  onZoomIn,
  onZoomOut,
  onSelectZoomPreset,
  themeComfort,
  onToggleTheme,
  onToggleDimImages,
  onToggleWarmSepia,
  onToggleSearch,
  isSidePanelOpen,
  onToggleSidePanel,
  noteBadgeCount,
  onSaveNotesMax,
  onExportPdf,
  isExportingPdf,
  onBackToLibrary,
}: WorkspaceHeaderProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [openMenu, setOpenMenu] = useState<'zoom' | 'theme' | 'export' | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuContainerRef.current?.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const commitPageJump = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(pageCount, Math.max(1, parsed));
      setPageInput(String(clamped));
      onJumpToPage(clamped);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handleThemeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.clientX > 0 || e.clientY > 0) {
      onToggleTheme({ x: e.clientX, y: e.clientY });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    onToggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  return (
    <header
      ref={menuContainerRef}
      className="nm-glass-bar nm-surface-colors relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
    >
      {/* Left: Back + Recessed Mode Switcher + Doc Title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBackToLibrary}
          className="nm-btn-ghost flex min-h-[36px] min-w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--nm-text-muted)]"
          title="My Library"
          aria-label="Back to My Library"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>

        {/* Draggable, lifting, extra-bouncy Mode Switcher */}
        <ModeSwitcher mode={mode} onChangeMode={onChangeMode} />

        <span
          className="nm-heading hidden max-w-[220px] truncate pl-1 text-[14px] font-medium text-[var(--nm-text-muted)] xl:inline"
          title={title}
        >
          {title}
        </span>
      </div>

      {/* Center: Page Jump + Zoom */}
      <div className="flex items-center gap-2">
        <div className="nm-recessed hidden items-center gap-0.5 rounded-full px-1 py-0.5 sm:flex">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onJumpToPage(Math.max(1, currentPage - 1))}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:cursor-default disabled:opacity-30"
            title="Previous page"
          >
            <ChevronLeft className="h-[17px] w-[17px]" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitPageJump();
            }}
            className="flex items-center gap-1 px-1.5"
          >
            <input
              type="text"
              inputMode="numeric"
              aria-label="Current page"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageJump}
              className="font-mono-num w-9 rounded-md bg-transparent text-center text-[13px] font-medium text-[var(--nm-text)] focus:bg-[var(--nm-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--nm-accent)]"
            />
            <span className="font-mono-num whitespace-nowrap text-[13px] text-[var(--nm-text-muted)]">
              / {pageCount}
            </span>
          </form>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => onJumpToPage(Math.min(pageCount, currentPage + 1))}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] disabled:cursor-default disabled:opacity-30"
            title="Next page"
          >
            <ChevronRight className="h-[17px] w-[17px]" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="nm-recessed relative flex items-center rounded-full px-1 py-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
            title="Zoom out (-)"
            aria-label="Zoom out"
          >
            <Minus className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'zoom' ? null : 'zoom'))}
            className="nm-btn-ghost font-mono-num flex min-h-[32px] cursor-pointer items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-[var(--nm-text)]"
            title="Zoom presets"
          >
            <span className="whitespace-nowrap">{Math.round(scale * 100)}%</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--nm-text-muted)]" />
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="nm-btn-ghost flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            <Plus className="h-[17px] w-[17px]" />
          </button>

          <AnimatePresence>
            {openMenu === 'zoom' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full left-0 z-50 mt-2 w-44 rounded-2xl border border-[var(--nm-border-strong)] bg-[var(--nm-surface)] p-1.5 shadow-[var(--nm-popover-shadow)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectZoomPreset('smart-fit');
                    setOpenMenu(null);
                  }}
                  className={`flex min-h-[34px] w-full cursor-pointer items-center justify-between rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 ${
                    zoomMode === 'smart-fit'
                      ? 'bg-[var(--nm-accent-soft)] text-[var(--nm-accent)]'
                      : 'text-[var(--nm-text)] hover:bg-[var(--nm-surface-hover)]'
                  }`}
                >
                  <span>Smart Fill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectZoomPreset('fit-width');
                    setOpenMenu(null);
                  }}
                  className={`flex min-h-[34px] w-full cursor-pointer items-center justify-between rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 ${
                    zoomMode === 'fit-width'
                      ? 'bg-[var(--nm-accent-soft)] text-[var(--nm-accent)]'
                      : 'text-[var(--nm-text)] hover:bg-[var(--nm-surface-hover)]'
                  }`}
                >
                  <span>Fit Width</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectZoomPreset('fit-page');
                    setOpenMenu(null);
                  }}
                  className={`flex min-h-[34px] w-full cursor-pointer items-center justify-between rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 ${
                    zoomMode === 'fit-page'
                      ? 'bg-[var(--nm-accent-soft)] text-[var(--nm-accent)]'
                      : 'text-[var(--nm-text)] hover:bg-[var(--nm-surface-hover)]'
                  }`}
                >
                  <span>Fit Page</span>
                </button>
                <div className="my-1 h-px bg-[var(--nm-border)]" />
                {[0.75, 1, 1.25, 1.5, 2, 2.5].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => {
                      onSelectZoomPreset('custom', z);
                      setOpenMenu(null);
                    }}
                    className={`font-mono-num flex min-h-[32px] w-full cursor-pointer items-center justify-between rounded-xl px-3 text-[13px] transition-colors duration-150 ${
                      zoomMode === 'custom' && Math.abs(scale - z) < 0.02
                        ? 'bg-[var(--nm-accent-soft)] font-medium text-[var(--nm-accent)]'
                        : 'text-[var(--nm-text)] hover:bg-[var(--nm-surface-hover)]'
                    }`}
                  >
                    <span>{Math.round(z * 100)}%</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Search, Circular-Ripple Theme Toggle + Comfort, Save/Export, Side Panel */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSearch}
          className="nm-btn-ghost flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
          title="Search PDF (Ctrl+F)"
          aria-label="Search PDF"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        {/* Dark/Light Circular Ripple Toggle + Comfort menu */}
        <div className="nm-recessed relative flex items-center rounded-full">
          <button
            type="button"
            data-theme-toggle="true"
            onClick={handleThemeClick}
            className="nm-btn-ghost flex min-h-[36px] cursor-pointer items-center gap-2 rounded-l-full px-3 text-[13px] font-medium text-[var(--nm-text)]"
            title="Toggle Dark / Light Mode (D)"
            aria-label="Toggle Dark or Light Mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              {themeComfort.theme === 'dark' ? (
                <motion.span
                  key="moon"
                  initial={{ rotate: -40, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 40, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex text-[var(--nm-accent)]"
                >
                  <Moon className="h-[18px] w-[18px]" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ rotate: 40, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -40, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex text-[var(--nm-accent)]"
                >
                  <Sun className="h-[18px] w-[18px]" />
                </motion.span>
              )}
            </AnimatePresence>
            <span className="hidden whitespace-nowrap md:inline">
              {themeComfort.theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'theme' ? null : 'theme'))}
            className="nm-btn-ghost flex min-h-[36px] min-w-[30px] cursor-pointer items-center justify-center rounded-r-full border-l border-[var(--nm-border)] px-2 text-[var(--nm-text-muted)]"
            title="Reading comfort options"
            aria-label="Reading comfort options"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <AnimatePresence>
            {openMenu === 'theme' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--nm-border-strong)] bg-[var(--nm-surface)] p-2.5 shadow-[var(--nm-popover-shadow)]"
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[var(--nm-text-muted)] uppercase">
                  Reading Comfort
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-[var(--nm-text)] transition-colors duration-150 hover:bg-[var(--nm-surface-hover)]">
                  <span>Dim Images in Dark Mode</span>
                  <input
                    type="checkbox"
                    checked={themeComfort.dimImagesInDark}
                    onChange={onToggleDimImages}
                    className="h-4 w-4 accent-[var(--nm-accent)]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-[var(--nm-text)] transition-colors duration-150 hover:bg-[var(--nm-surface-hover)]">
                  <span>Warm Sepia Tint</span>
                  <input
                    type="checkbox"
                    checked={themeComfort.warmSepiaTint}
                    onChange={onToggleWarmSepia}
                    className="h-4 w-4 accent-[var(--nm-accent)]"
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save & Export Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
            className="nm-recessed nm-btn-ghost flex min-h-[36px] min-w-[36px] cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-[var(--nm-text)]"
            title="Save .notesmax or Export Annotated PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-[var(--nm-accent)]" />
            ) : (
              <Download className="h-[18px] w-[18px] text-[var(--nm-accent)]" />
            )}
            <span className="hidden whitespace-nowrap lg:inline">Save / Export</span>
            <span className="hidden whitespace-nowrap sm:inline lg:hidden">Export</span>
          </button>

          <AnimatePresence>
            {openMenu === 'export' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-[var(--nm-border-strong)] bg-[var(--nm-surface)] p-1.5 shadow-[var(--nm-popover-shadow)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSaveNotesMax();
                    setOpenMenu(null);
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--nm-surface-hover)]"
                >
                  <Save className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--nm-accent)]" />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--nm-text)]">
                      Save Local (.notesmax)
                    </div>
                    <div className="text-[12px] text-[var(--nm-text-muted)]">
                      Full PDF + highlights, drawings, links & images
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => {
                    onExportPdf();
                    setOpenMenu(null);
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--nm-surface-hover)] disabled:opacity-50"
                >
                  <FileDown className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--nm-accent)]" />
                  <div>
                    <div className="text-[13px] font-medium text-[var(--nm-text)]">
                      Export Annotated PDF
                    </div>
                    <div className="text-[12px] text-[var(--nm-text-muted)]">
                      Standard .pdf with baked highlights, ink & notes
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle Docked Side Panel */}
        <button
          type="button"
          onClick={onToggleSidePanel}
          style={
            isSidePanelOpen
              ? {
                  backgroundColor: 'var(--nm-accent-soft)',
                  borderColor: 'var(--nm-accent)',
                  color: 'var(--nm-accent)',
                }
              : undefined
          }
          className={`flex min-h-[36px] min-w-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ${
            isSidePanelOpen
              ? ''
              : 'nm-recessed nm-btn-ghost text-[var(--nm-text-muted)]'
          }`}
          title="Toggle Study Notes Panel"
        >
          <PanelRight className="h-[18px] w-[18px]" />
          <span className="font-mono-num text-[12px] font-semibold">{noteBadgeCount}</span>
        </button>
      </div>
    </header>
  );
}
