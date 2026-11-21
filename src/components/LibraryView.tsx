import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  BookOpen,
  FileArchive,
  FileText,
  FileUp,
  Highlighter,
  Moon,
  PenTool,
  Search,
  Sun,
  Trash2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { LibraryDocumentSummary, WorkspaceTheme } from '../types';
import { formatBytes, formatRelativeTime } from '../utils/format';

interface LibraryViewProps {
  documents: LibraryDocumentSummary[];
  isLoading: boolean;
  theme: WorkspaceTheme;
  onToggleTheme: (origin?: { x: number; y: number }) => void;
  onOpenPdfFiles: (files: FileList | File[]) => void;
  onOpenSamplePdf: () => void;
  onSelectDocument: (hash: string) => void;
  onDeleteDocument: (hash: string) => void;
}

type LibrarySort = 'recent' | 'title' | 'notes';

export function LibraryView({
  documents,
  isLoading,
  theme,
  onToggleTheme,
  onOpenPdfFiles,
  onOpenSamplePdf,
  onSelectDocument,
  onDeleteDocument,
}: LibraryViewProps) {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const bundleInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<LibrarySort>('recent');
  const [confirmDeleteHash, setConfirmDeleteHash] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = documents.filter((d) => {
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'notes') {
        const aTotal = a.highlightCount + a.drawingCount;
        const bTotal = b.highlightCount + b.drawingCount;
        return bTotal - aTotal || b.lastOpenedAt - a.lastOpenedAt;
      }
      return b.lastOpenedAt - a.lastOpenedAt;
    });
  }, [documents, search, sortBy]);

  const handleThemeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.clientX > 0 || e.clientY > 0) {
      onToggleTheme({ x: e.clientX, y: e.clientY });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    onToggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  return (
    <div className="nm-surface-colors flex min-h-screen flex-col bg-[var(--nm-bg)] text-[var(--nm-text)]">
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onOpenPdfFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={bundleInputRef}
        type="file"
        accept=".notesmax,application/json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onOpenPdfFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Minimal Top Navigation */}
      <header className="nm-glass-bar nm-surface-colors sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/app-icon.png"
              alt="NotesMaxxing icon"
              className="h-8 w-8 rounded-[9px] border border-[var(--nm-border-strong)] object-cover"
            />
            <span className="nm-heading text-[16px] font-semibold tracking-tight">
              NotesMaxxing
            </span>
          </div>

          <button
            type="button"
            data-theme-toggle="true"
            onClick={handleThemeClick}
            className="nm-recessed nm-btn-ghost flex min-h-[36px] min-w-[36px] cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[var(--nm-text)]"
            title="Toggle Dark / Light Mode (D)"
            aria-label="Toggle Dark or Light Mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
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
            <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* Apple-Inspired Editorial Hero Section */}
        <section className="flex flex-col items-center py-20 text-center">
          <img
            src="/app-icon.png"
            alt="Study: Dont Look"
            className="mb-7 h-16 w-16 rounded-[18px] border border-[var(--nm-border-strong)] object-cover"
          />

          <h1 className="nm-hero-heading max-w-2xl text-4xl font-semibold text-[var(--nm-text)] sm:text-5xl">
            Read deep. Remember everything.
          </h1>

          <p className="mt-4 max-w-xl text-[16px] leading-[1.6] text-[var(--nm-text-muted)]">
            A calm, local-first PDF study studio with smart dark mode, vector circling, rich margin notes, and zero cloud lock-in.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              style={{
                backgroundColor: 'var(--nm-accent)',
                color: 'var(--nm-accent-fg)',
              }}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-6 text-[14px] font-semibold transition-opacity duration-150 hover:opacity-90"
            >
              <FileUp className="h-[18px] w-[18px]" />
              <span>Open PDF</span>
            </button>

            <button
              type="button"
              onClick={() => bundleInputRef.current?.click()}
              className="nm-btn-ghost inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--nm-border)] bg-[var(--nm-surface)] px-5 text-[14px] font-medium text-[var(--nm-text)] hover:border-[var(--nm-border-strong)]"
            >
              <FileArchive className="h-[17px] w-[17px] text-[var(--nm-text-muted)]" />
              <span>Open .notesmax</span>
            </button>

            <button
              type="button"
              onClick={onOpenSamplePdf}
              className="nm-btn-ghost inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-[var(--nm-border)] bg-[var(--nm-surface)] px-5 text-[14px] font-medium text-[var(--nm-text-muted)] hover:border-[var(--nm-border-strong)] hover:text-[var(--nm-text)]"
            >
              <BookOpen className="h-[17px] w-[17px] text-[var(--nm-accent)]" />
              <span>Sample Study PDF</span>
            </button>
          </div>

          <div
            onClick={() => pdfInputRef.current?.click()}
            className="mt-7 w-full max-w-lg cursor-pointer rounded-2xl border border-dashed border-[var(--nm-border-strong)] px-5 py-3.5 text-[13px] text-[var(--nm-text-muted)] transition-colors duration-150 hover:border-[var(--nm-accent)] hover:text-[var(--nm-text)]"
          >
            or drop a <code className="font-mono-num text-[12px]">.pdf</code> or{' '}
            <code className="font-mono-num text-[12px]">.notesmax</code> file anywhere on this window
          </div>
        </section>

        {/* Refined "Your Library" Showcase Section */}
        <section className="border-t border-[var(--nm-border)] pt-10 pb-16">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-baseline gap-3">
              <h2 className="nm-heading text-xl font-semibold text-[var(--nm-text)]">
                Your Library
              </h2>
              <span className="font-mono-num text-[13px] text-[var(--nm-text-muted)]">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'}
              </span>
            </div>

            {documents.length > 1 && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-full border border-[var(--nm-border)] bg-[var(--nm-surface)] px-3.5 py-1.5">
                  <Search className="h-4 w-4 text-[var(--nm-text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search library..."
                    className="w-44 bg-transparent text-[13px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-muted)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-[var(--nm-border)] bg-[var(--nm-surface)] px-3 py-1.5 text-[13px]">
                  <ArrowUpDown className="h-3.5 w-3.5 text-[var(--nm-text-muted)]" />
                  <select
                    aria-label="Sort library"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as LibrarySort)}
                    className="cursor-pointer bg-transparent font-medium text-[var(--nm-text)] focus:outline-none"
                  >
                    <option value="recent" className="bg-[var(--nm-surface)] text-[var(--nm-text)]">
                      Recent
                    </option>
                    <option value="notes" className="bg-[var(--nm-surface)] text-[var(--nm-text)]">
                      Most Notes
                    </option>
                    <option value="title" className="bg-[var(--nm-surface)] text-[var(--nm-text)]">
                      Title (A–Z)
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-64 animate-pulse rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface)]"
                />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface)] px-6 py-12 text-center">
              <p className="text-[14px] text-[var(--nm-text-muted)]">
                Your local library is empty. Open a PDF or load the Sample Study PDF above—every highlight, circle, and note is saved automatically in IndexedDB.
              </p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-14 text-center text-[14px] text-[var(--nm-text-muted)]">
              No documents match “{search}”.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSorted.map((doc) => {
                const isConfirming = confirmDeleteHash === doc.hash;
                return (
                  <div
                    key={doc.hash}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectDocument(doc.hash)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectDocument(doc.hash);
                      }
                    }}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--nm-border)] bg-[var(--nm-surface)] transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--nm-border-strong)]"
                  >
                    {/* Crisp Cover Thumbnail (no scale() blur) */}
                    <div className="relative h-48 w-full overflow-hidden border-b border-[var(--nm-border)] bg-[var(--nm-surface-subtle)]">
                      {doc.thumbnailDataUrl ? (
                        <img
                          src={doc.thumbnailDataUrl}
                          alt={doc.title}
                          className={`h-full w-full object-cover object-top ${
                            theme === 'dark' ? 'pdf-canvas-dark' : ''
                          }`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--nm-text-muted)]">
                          <FileText className="h-8 w-8 opacity-40" />
                        </div>
                      )}

                      <div className="font-mono-num absolute bottom-3 left-3 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] text-zinc-100">
                        p. {doc.lastPage}/{doc.pageCount}
                      </div>

                      {/* Delete action */}
                      <div
                        className="absolute top-3 right-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 rounded-full border border-[var(--nm-border-strong)] bg-[var(--nm-surface)] px-3 py-1 text-[12px]">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteHash(null);
                                onDeleteDocument(doc.hash);
                              }}
                              className="cursor-pointer font-semibold text-rose-500 hover:text-rose-400"
                            >
                              Delete
                            </button>
                            <span className="text-[var(--nm-text-muted)]">/</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteHash(null)}
                              className="cursor-pointer text-[var(--nm-text-muted)] hover:text-[var(--nm-text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteHash(doc.hash)}
                            className="cursor-pointer rounded-full bg-black/65 p-1.5 text-zinc-200 opacity-0 transition-opacity duration-150 hover:bg-rose-600 hover:text-white group-hover:opacity-100"
                            title="Delete from library"
                            aria-label={`Delete ${doc.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Generous Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <h3 className="nm-heading line-clamp-1 text-[15px] font-semibold text-[var(--nm-text)]">
                          {doc.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 font-mono-num text-[12px] text-[var(--nm-text-muted)]">
                          {doc.fileName} · {formatBytes(doc.fileSize)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[var(--nm-border)] pt-3.5 text-[12px] text-[var(--nm-text-muted)]">
                        <div className="flex items-center gap-3.5 font-mono-num">
                          <span className="inline-flex items-center gap-1.5" title="Highlights & Notes">
                            <Highlighter className="h-3.5 w-3.5 text-[var(--nm-accent)]" />
                            {doc.highlightCount}
                            {doc.noteCount > 0 ? ` (${doc.noteCount})` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1.5" title="Drawings & Circles">
                            <PenTool className="h-3.5 w-3.5 text-[var(--nm-text-muted)]" />
                            {doc.drawingCount}
                          </span>
                        </div>
                        <span className="font-mono-num">{formatRelativeTime(doc.lastOpenedAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
