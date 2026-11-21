import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ExternalLink,
  ImagePlus,
  Link2,
  ListFilter,
  Play,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HIGHLIGHT_COLORS,
  type HighlightAnnotation,
  type HighlightColor,
  type NoteImage,
  type NoteLink,
} from '../types';
import { createId } from '../utils/hash';
import { compressImageFile } from '../utils/imageCompressor';
import {
  formatTimestamp,
  getDomainLabel,
  normalizeUrl,
  parseYouTubeUrl,
} from '../utils/youtube';
import { MarkdownPreview } from './MarkdownPreview';

interface SideNotesPanelProps {
  isOpen: boolean;
  activeTab: 'note' | 'all';
  onChangeTab: (tab: 'note' | 'all') => void;
  highlights: HighlightAnnotation[];
  activeHighlightId: string | null;
  onSelectHighlightFromIndex: (highlight: HighlightAnnotation) => void;
  onUpdateHighlight: (id: string, patch: Partial<HighlightAnnotation>) => void;
  onDeleteHighlight: (id: string) => void;
  onClosePanel: () => void;
  onOpenImageLightbox: (image: NoteImage) => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'mint', 'coral', 'sage'];

const SPRING_FLUID = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 26,
  mass: 0.75,
};

const SPRING_PANEL = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 32,
  mass: 0.85,
};

function getInitialPanelWidth(): number {
  if (typeof window === 'undefined') return 400;
  return Math.round(Math.min(480, Math.max(360, window.innerWidth * 0.28)));
}

function YouTubeLinkCard({
  link,
  onDelete,
}: {
  link: NoteLink;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const yt = link.youtube;
  if (!yt) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_FLUID}
      className="group relative overflow-hidden rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] transition-colors duration-150 hover:border-[var(--nm-border-strong)]"
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-stretch gap-3 p-2.5"
      >
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
          {!imgError ? (
            <img
              src={yt.thumbnailUrl}
              alt={link.title || 'YouTube lecture reference'}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[var(--nm-accent)]">
              <Play className="h-5 w-5" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/15">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          </div>
          {yt.timestampSeconds !== undefined && (
            <span className="font-mono-num absolute right-1.5 bottom-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatTimestamp(yt.timestampSeconds)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="line-clamp-2 pr-5 text-[14px] font-medium text-[var(--nm-text)]">
            {link.title?.trim() || `YouTube Video (${yt.videoId})`}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--nm-accent)]">
            <span className="truncate">{getDomainLabel(link.url)}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </div>
        </div>
      </a>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 cursor-pointer rounded-lg p-1 text-[var(--nm-text-muted)] opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
        title="Remove link"
        aria-label="Remove link"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function SideNotesPanel({
  isOpen,
  activeTab,
  onChangeTab,
  highlights,
  activeHighlightId,
  onSelectHighlightFromIndex,
  onUpdateHighlight,
  onDeleteHighlight,
  onClosePanel,
  onOpenImageLightbox,
}: SideNotesPanelProps) {
  const [panelWidth, setPanelWidth] = useState(getInitialPanelWidth);
  const isResizingRef = useRef(false);

  const activeHighlight = useMemo(
    () => highlights.find((h) => h.id === activeHighlightId) ?? null,
    [highlights, activeHighlightId],
  );

  const [draftText, setDraftText] = useState('');
  const [editorView, setEditorView] = useState<'write' | 'preview'>('write');
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [indexFilter, setIndexFilter] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftText(activeHighlight?.noteText ?? '');
    setSaveState('idle');
    setLinkError(null);
    if (activeHighlight && activeTab === 'note' && isOpen) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [activeHighlight?.id, activeTab, isOpen]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const next = Math.min(520, Math.max(360, window.innerWidth - e.clientX));
      setPanelWidth(next);
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleTextChange = (nextVal: string) => {
    setDraftText(nextVal);
    if (!activeHighlight) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const targetId = activeHighlight.id;
    debounceTimerRef.current = window.setTimeout(() => {
      onUpdateHighlight(targetId, { noteText: nextVal, updatedAt: Date.now() });
      setSaveState('saved');
    }, 220);
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHighlight) return;
    const normalized = normalizeUrl(linkUrlInput);
    if (!normalized) {
      setLinkError('Enter a valid URL (e.g. youtube.com/watch?v=...)');
      return;
    }
    setLinkError(null);
    const yt = parseYouTubeUrl(normalized);
    const newLink: NoteLink = {
      id: createId(),
      url: normalized,
      title: linkTitleInput.trim() || undefined,
      youtube: yt,
    };
    onUpdateHighlight(activeHighlight.id, {
      links: [...activeHighlight.links, newLink],
      updatedAt: Date.now(),
    });
    setLinkUrlInput('');
    setLinkTitleInput('');
  };

  const handleAttachImages = async (files: FileList | File[]) => {
    if (!activeHighlight) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsCompressingImage(true);
    try {
      const compressed: NoteImage[] = [];
      for (const file of imageFiles) {
        const img = await compressImageFile(file);
        compressed.push(img);
      }
      onUpdateHighlight(activeHighlight.id, {
        images: [...activeHighlight.images, ...compressed],
        updatedAt: Date.now(),
      });
    } finally {
      setIsCompressingImage(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'note' || !activeHighlight) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void handleAttachImages(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  });

  const sortedHighlights = useMemo(() => {
    const q = indexFilter.trim().toLowerCase();
    return [...highlights]
      .filter((h) => {
        if (!q) return true;
        return (
          h.quote.toLowerCase().includes(q) ||
          h.noteText.toLowerCase().includes(q) ||
          h.links.some((l) => (l.title ?? l.url).toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.pageNumber - b.pageNumber || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));
  }, [highlights, indexFilter]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: panelWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={SPRING_PANEL}
          style={{ maxWidth: '92vw' }}
          className="nm-glass-bar nm-surface-colors fixed inset-y-0 right-0 z-35 flex h-full shrink-0 flex-col border-l md:relative md:inset-auto md:z-20"
        >
          {/* Left-edge drag resize handle */}
          <div
            onMouseDown={() => {
              isResizingRef.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            className="absolute inset-y-0 -left-1 hidden w-2 cursor-col-resize hover:bg-[var(--nm-accent)]/30 md:block"
            title="Drag to resize panel"
          />

          {/* Panel Header + Tabs */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--nm-border)] px-4 py-2.5">
            <div className="nm-recessed flex items-center gap-0.5 rounded-full p-1">
              {(
                [
                  { id: 'note', label: 'Note', icon: StickyNote },
                  { id: 'all', label: 'All Notes', icon: ListFilter, count: highlights.length },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChangeTab(tab.id)}
                    className={`relative flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-150 ${
                      active
                        ? 'text-[var(--nm-text)]'
                        : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="activePanelTabPill"
                        transition={SPRING_FLUID}
                        className="pointer-events-none absolute inset-0 rounded-full bg-[var(--nm-surface)] shadow-xs"
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5 text-[var(--nm-accent)]" />
                    <span className="relative z-10">{tab.label}</span>
                    {'count' in tab && (
                      <span className="font-mono-num relative z-10 text-[11px] text-[var(--nm-text-muted)]">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClosePanel}
              className="nm-btn-ghost flex min-h-[34px] min-w-[34px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)]"
              title="Close panel"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Tab 1: Active Note Editor */}
          {activeTab === 'note' && (
            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              {!activeHighlight ? (
                <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--nm-accent-soft)] text-[var(--nm-accent)]">
                    <StickyNote className="h-5 w-5" />
                  </div>
                  <p className="nm-heading text-[16px] font-semibold text-[var(--nm-text)]">
                    No highlight selected
                  </p>
                  <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--nm-text-muted)]">
                    Switch to{' '}
                    <kbd className="font-mono-num rounded-md bg-[var(--nm-surface-subtle)] px-1.5 py-0.5 text-[12px]">
                      N
                    </kbd>{' '}
                    Notes Mode and drag across any text in the PDF to highlight and attach study notes, YouTube timestamps, or handwritten photos.
                  </p>
                </div>
              ) : (
                <motion.div
                  key={activeHighlight.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING_FLUID}
                  className="flex flex-col gap-5"
                >
                  {/* Quote + Shared-Layout Color Swatches + Meta */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-num rounded-full bg-[var(--nm-surface-subtle)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--nm-text-muted)]">
                          Page {activeHighlight.pageNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {COLOR_ORDER.map((c) => {
                            const spec = HIGHLIGHT_COLORS[c];
                            const selected = activeHighlight.color === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  onUpdateHighlight(activeHighlight.id, {
                                    color: c,
                                    updatedAt: Date.now(),
                                  })
                                }
                                className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
                                title={spec.label}
                              >
                                {selected && (
                                  <motion.span
                                    layoutId="activeColorRing"
                                    transition={SPRING_FLUID}
                                    className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--nm-accent)]"
                                  />
                                )}
                                <span
                                  className="relative z-10 h-3.5 w-3.5 rounded-full border border-black/15"
                                  style={{ backgroundColor: spec.swatch }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {saveState === 'saved' && (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-500">
                            <Check className="h-3.5 w-3.5" /> Saved
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteHighlight(activeHighlight.id)}
                          className="flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-full text-[var(--nm-text-muted)] transition-colors duration-150 hover:bg-rose-500/15 hover:text-rose-400"
                          title="Delete highlight & note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <blockquote
                      style={{
                        borderLeftColor:
                          HIGHLIGHT_COLORS[activeHighlight.color]?.underline ?? '#F59E0B',
                      }}
                      className="rounded-r-xl border-l-3 bg-[var(--nm-surface-subtle)] px-3.5 py-2.5 text-[14px] leading-[1.55] text-[var(--nm-text-muted)]"
                    >
                      “{activeHighlight.quote}”
                    </blockquote>
                  </div>

                  {/* Rich Text / Markdown Note Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider text-[var(--nm-text-muted)] uppercase">
                        Study Note
                      </span>
                      <div className="nm-recessed flex items-center gap-0.5 rounded-full p-0.5 text-[12px]">
                        <button
                          type="button"
                          onClick={() => setEditorView('write')}
                          className={`cursor-pointer rounded-full px-2.5 py-0.5 font-medium transition-colors duration-150 ${
                            editorView === 'write'
                              ? 'bg-[var(--nm-surface)] text-[var(--nm-text)] shadow-xs'
                              : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]'
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorView('preview')}
                          className={`cursor-pointer rounded-full px-2.5 py-0.5 font-medium transition-colors duration-150 ${
                            editorView === 'preview'
                              ? 'bg-[var(--nm-surface)] text-[var(--nm-text)] shadow-xs'
                              : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {editorView === 'write' ? (
                      <textarea
                        ref={textareaRef}
                        value={draftText}
                        onChange={(e) => handleTextChange(e.target.value)}
                        rows={6}
                        placeholder="Write key takeaways, intuition, exam reminders, or Markdown (- bullet, **bold**, `code`)..."
                        className="w-full resize-y rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] p-3.5 text-[15px] leading-[1.6] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)]/70 focus:border-[var(--nm-accent)] focus:outline-none"
                      />
                    ) : (
                      <div className="min-h-[156px] rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] p-3.5">
                        <MarkdownPreview content={draftText} />
                      </div>
                    )}
                  </div>

                  {/* Smart Links & YouTube Section */}
                  <div className="space-y-2.5">
                    <span className="block text-[11px] font-semibold tracking-wider text-[var(--nm-text-muted)] uppercase">
                      Links & YouTube
                    </span>

                    <form onSubmit={handleAddLink} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={linkUrlInput}
                          onChange={(e) => setLinkUrlInput(e.target.value)}
                          placeholder="Paste YouTube or article URL..."
                          className="min-w-0 flex-1 rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] px-3 py-2 text-[14px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)]/70 focus:border-[var(--nm-accent)] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="nm-btn-ghost inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] px-3 py-2 text-[13px] font-medium text-[var(--nm-text)] hover:border-[var(--nm-accent)] hover:text-[var(--nm-accent)]"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={linkTitleInput}
                        onChange={(e) => setLinkTitleInput(e.target.value)}
                        placeholder="Optional custom title (e.g. Lecture 4 @ 14:20)"
                        className="w-full rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] px-3 py-1.5 text-[13px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)]/60 focus:border-[var(--nm-accent)] focus:outline-none"
                      />
                      {linkError && <p className="text-[12px] text-rose-400">{linkError}</p>}
                    </form>

                    {activeHighlight.links.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {activeHighlight.links.map((link) =>
                          link.youtube ? (
                            <YouTubeLinkCard
                              key={link.id}
                              link={link}
                              onDelete={() =>
                                onUpdateHighlight(activeHighlight.id, {
                                  links: activeHighlight.links.filter((l) => l.id !== link.id),
                                  updatedAt: Date.now(),
                                })
                              }
                            />
                          ) : (
                            <motion.div
                              key={link.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={SPRING_FLUID}
                              className="group flex items-center justify-between gap-2 rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] px-3 py-2.5"
                            >
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-[var(--nm-text)] hover:text-[var(--nm-accent)]"
                              >
                                <Link2 className="h-4 w-4 shrink-0 text-[var(--nm-accent)]" />
                                <span className="truncate font-medium">
                                  {link.title || getDomainLabel(link.url)}
                                </span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--nm-text-muted)]" />
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateHighlight(activeHighlight.id, {
                                    links: activeHighlight.links.filter((l) => l.id !== link.id),
                                    updatedAt: Date.now(),
                                  })
                                }
                                className="cursor-pointer rounded p-1 text-[var(--nm-text-muted)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                                title="Remove link"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </motion.div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Handwritten Notes / Image Attachments */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider text-[var(--nm-text-muted)] uppercase">
                        Handwritten Notes & Images
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--nm-accent)] transition-colors duration-150 hover:bg-[var(--nm-accent-soft)]"
                      >
                        <ImagePlus className="h-4 w-4" />
                        <span>Upload Image</span>
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          void handleAttachImages(e.target.files);
                          e.target.value = '';
                        }
                      }}
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(true);
                      }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(false);
                        if (e.dataTransfer.files) {
                          void handleAttachImages(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-2xl border border-dashed px-4 py-3.5 text-center transition-colors duration-150 ${
                        isDraggingImage
                          ? 'border-[var(--nm-accent)] bg-[var(--nm-accent-soft)]'
                          : 'border-[var(--nm-border-strong)] bg-[var(--nm-surface-subtle)] hover:border-[var(--nm-accent)]'
                      }`}
                    >
                      <p className="text-[13px] leading-relaxed text-[var(--nm-text-muted)]">
                        {isCompressingImage
                          ? 'Optimizing image...'
                          : 'Drop handwritten photo, click to upload, or press Ctrl+V to paste screenshot'}
                      </p>
                    </div>

                    {activeHighlight.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        {activeHighlight.images.map((img) => (
                          <div
                            key={img.id}
                            className="group relative overflow-hidden rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)]"
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.name}
                              onClick={() => onOpenImageLightbox(img)}
                              className="h-28 w-full cursor-zoom-in object-cover"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateHighlight(activeHighlight.id, {
                                  images: activeHighlight.images.filter((i) => i.id !== img.id),
                                  updatedAt: Date.now(),
                                });
                              }}
                              className="absolute top-1.5 right-1.5 cursor-pointer rounded-lg bg-black/70 p-1 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                              title="Delete image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Tab 2: Revision Sidebar (All Notes Index) */}
          {activeTab === 'all' && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-[var(--nm-border)] p-3.5">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] px-3 py-2">
                  <Search className="h-4 w-4 text-[var(--nm-text-muted)]" />
                  <input
                    type="text"
                    value={indexFilter}
                    onChange={(e) => setIndexFilter(e.target.value)}
                    placeholder="Filter highlights & notes..."
                    className="w-full bg-transparent text-[14px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)] focus:outline-none"
                  />
                  {indexFilter && (
                    <button
                      type="button"
                      onClick={() => setIndexFilter('')}
                      className="cursor-pointer text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {sortedHighlights.length === 0 ? (
                  <div className="py-12 text-center text-[14px] text-[var(--nm-text-muted)]">
                    {highlights.length === 0
                      ? 'No highlights yet. Use Notes Mode (N) to highlight text.'
                      : 'No notes match your filter.'}
                  </div>
                ) : (
                  sortedHighlights.map((item, idx) => {
                    const spec = HIGHLIGHT_COLORS[item.color] ?? HIGHLIGHT_COLORS.yellow;
                    const isSelected = activeHighlightId === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          ...SPRING_FLUID,
                          delay: Math.min(idx * 0.03, 0.24),
                        }}
                        onClick={() => onSelectHighlightFromIndex(item)}
                        style={
                          isSelected
                            ? {
                                borderColor: 'var(--nm-accent)',
                                backgroundColor: 'var(--nm-accent-soft)',
                              }
                            : undefined
                        }
                        className={`w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-colors duration-150 ${
                          isSelected
                            ? ''
                            : 'border-[var(--nm-border)] bg-[var(--nm-surface-subtle)] hover:border-[var(--nm-border-strong)] hover:bg-[var(--nm-surface-hover)]'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: spec.swatch }}
                            />
                            <span className="font-mono-num text-[12px] font-medium text-[var(--nm-text-muted)]">
                              p. {item.pageNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-num text-[11px] text-[var(--nm-text-muted)]">
                            {item.links.length > 0 && <span>{item.links.length} link</span>}
                            {item.images.length > 0 && <span>{item.images.length} img</span>}
                          </div>
                        </div>

                        <p className="line-clamp-2 text-[13px] leading-[1.5] text-[var(--nm-text-muted)]">
                          “{item.quote}”
                        </p>

                        {item.noteText.trim() && (
                          <p className="mt-2 line-clamp-2 text-[14px] font-medium leading-[1.5] text-[var(--nm-text)]">
                            {item.noteText.trim()}
                          </p>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
