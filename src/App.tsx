import { AnimatePresence, motion } from 'framer-motion';
import { FileUp } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawSubBar } from './components/DrawSubBar';
import { HelpGuideButton } from './components/HelpGuideButton';
import { ImageLightbox } from './components/ImageLightbox';
import { LibraryView } from './components/LibraryView';
import { PdfViewer } from './components/PdfViewer';
import { SearchBar } from './components/SearchBar';
import { SideNotesPanel } from './components/SideNotesPanel';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import {
  deleteDocumentAndAnnotations,
  getDocumentWithAnnotations,
  getLibrarySummaries,
  removeDrawing,
  removeHighlight,
  restoreBundleToDb,
  updateDocumentProgress,
  upsertDocument,
  upsertDrawing,
  upsertHighlight,
} from './db/database';
import { useThemeComfort } from './hooks/useThemeComfort';
import { useUndoRedoDrawings } from './hooks/useUndoRedoDrawings';
import type {
  DrawTool,
  DrawingStroke,
  HighlightAnnotation,
  LibraryDocumentSummary,
  NormalizedRect,
  NoteImage,
  SearchResult,
  StudyDocument,
  StudyMode,
  ZoomMode,
} from './types';
import { computeSha256Hex, createId } from './utils/hash';
import {
  parseNotesMaxBundle,
  serializeNotesMaxBundle,
  triggerBlobDownload,
} from './utils/notesmaxBundle';
import { exportAnnotatedPdf } from './utils/pdfExport';
import { pdfjsLib } from './utils/pdfWorker';
import { generateSampleStudyPdf } from './utils/samplePdf';

async function generateFirstPageThumbnail(pdfDoc: PDFDocumentProxy): Promise<string | undefined> {
  try {
    const page = await pdfDoc.getPage(1);
    const vp = page.getViewport({ scale: 0.45 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    await page.render({ canvas, viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined;
  }
}

export default function App() {
  const { settings: themeComfort, toggleTheme, toggleDimImages, toggleWarmSepia } =
    useThemeComfort();

  // Library state
  const [libraryDocs, setLibraryDocs] = useState<LibraryDocumentSummary[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);

  // Active reader workspace state
  const [activeDoc, setActiveDoc] = useState<StudyDocument | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [highlights, setHighlights] = useState<HighlightAnnotation[]>([]);
  const [drawings, setDrawings] = useState<DrawingStroke[]>([]);

  // Modes & tools
  const [mode, setMode] = useState<StudyMode>('notes');
  const [drawTool, setDrawTool] = useState<DrawTool>('freehand');
  const [drawColor, setDrawColor] = useState<string>('#EF4444');
  const [drawWidth, setDrawWidth] = useState<number>(0.004);

  // Viewport navigation & zoom
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('smart-fit');
  const [scrollRequest, setScrollRequest] = useState<{ page: number; nonce: number } | null>(null);

  // Side Panel & Highlight focus
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<'note' | 'all'>('note');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [floatingHighlightId, setFloatingHighlightId] = useState<string | null>(null);
  const [flashingHighlightId, setFlashingHighlightId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<NoteImage | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const pageTextCacheRef = useRef<Map<number, string>>(new Map());

  // Global drag-and-drop & toast/export feedback
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  const refreshLibrary = useCallback(async () => {
    setIsLibraryLoading(true);
    try {
      const list = await getLibrarySummaries();
      setLibraryDocs(list);
    } finally {
      setIsLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  // Undo / Redo for drawing strokes
  const {
    canUndo,
    canRedo,
    recordAdd,
    recordRemove,
    undo,
    redo,
    resetHistory,
  } = useUndoRedoDrawings({
    onPersistAdd: upsertDrawing,
    onPersistRemove: removeDrawing,
  });

  // Load a StudyDocument into the active PDF.js workspace
  const mountDocumentInWorkspace = useCallback(
    async (
      doc: StudyDocument,
      loadedHighlights: HighlightAnnotation[],
      loadedDrawings: DrawingStroke[],
    ) => {
      // Destroy previous PDF.js document cleanly
      if (loadingTaskRef.current) {
        void loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }
      setPdfDoc(null);
      pageTextCacheRef.current.clear();
      resetHistory();

      // Clone ArrayBuffer before handing to PDF.js worker so doc.pdfData never detaches
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(doc.pdfData.slice(0)),
      });
      loadingTaskRef.current = loadingTask;
      const loadedPdf = await loadingTask.promise;

      let updatedDoc = doc;
      if (!doc.thumbnailDataUrl || doc.pageCount !== loadedPdf.numPages) {
        const thumb = doc.thumbnailDataUrl ?? (await generateFirstPageThumbnail(loadedPdf));
        updatedDoc = {
          ...doc,
          pageCount: loadedPdf.numPages,
          thumbnailDataUrl: thumb,
        };
        await upsertDocument(updatedDoc);
      }

      setActiveDoc(updatedDoc);
      setPdfDoc(loadedPdf);
      setHighlights(loadedHighlights);
      setDrawings(loadedDrawings);
      setCurrentPage(updatedDoc.lastPage || 1);
      setScale(updatedDoc.lastZoom || 1.25);
      setZoomMode('smart-fit');
      setActiveHighlightId(null);
      setFloatingHighlightId(null);
      setIsSidePanelOpen(false);
      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);

      if (updatedDoc.lastPage > 1) {
        setTimeout(() => {
          setScrollRequest({ page: updatedDoc.lastPage, nonce: Date.now() });
        }, 120);
      }
    },
    [resetHistory],
  );

  // Open an existing library document by hash
  const handleSelectLibraryDoc = useCallback(
    async (hash: string) => {
      try {
        const result = await getDocumentWithAnnotations(hash);
        if (!result) {
          showToast('Document could not be found in local storage.');
          return;
        }
        await mountDocumentInWorkspace(result.document, result.highlights, result.drawings);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to open document.');
      }
    },
    [mountDocumentInWorkspace, showToast],
  );

  // Open new PDF or .notesmax file(s)
  const handleOpenFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;

      try {
        if (file.name.toLowerCase().endsWith('.notesmax')) {
          const restored = await parseNotesMaxBundle(file);
          await restoreBundleToDb(restored.document, restored.highlights, restored.drawings);
          await mountDocumentInWorkspace(
            restored.document,
            restored.highlights,
            restored.drawings,
          );
          await refreshLibrary();
          showToast(`Restored "${restored.document.title}"`);
          return;
        }

        if (
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf')
        ) {
          const buffer = await file.arrayBuffer();
          const hash = await computeSha256Hex(buffer);

          // Check if already stored in Dexie (auto-restore annotations!)
          const existing = await getDocumentWithAnnotations(hash);
          if (existing) {
            await mountDocumentInWorkspace(
              existing.document,
              existing.highlights,
              existing.drawings,
            );
            await refreshLibrary();
            showToast('Restored saved notes & highlights');
            return;
          }

          const now = Date.now();
          const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
          const newDoc: StudyDocument = {
            hash,
            title: cleanTitle || 'Untitled PDF',
            fileName: file.name,
            fileSize: buffer.byteLength,
            pageCount: 1,
            pdfData: buffer,
            lastPage: 1,
            lastZoom: 1.15,
            createdAt: now,
            lastOpenedAt: now,
          };

          await upsertDocument(newDoc);
          await mountDocumentInWorkspace(newDoc, [], []);
          await refreshLibrary();
          return;
        }

        showToast('Please open a .pdf or .notesmax file.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to load file.');
      }
    },
    [mountDocumentInWorkspace, refreshLibrary, showToast],
  );

  const handleOpenSamplePdf = useCallback(async () => {
    try {
      const sampleFile = await generateSampleStudyPdf();
      await handleOpenFiles([sampleFile]);
    } catch {
      showToast('Failed to generate sample study PDF.');
    }
  }, [handleOpenFiles, showToast]);

  const handleDeleteLibraryDoc = useCallback(
    async (hash: string) => {
      await deleteDocumentAndAnnotations(hash);
      await refreshLibrary();
      showToast('Removed from library');
    },
    [refreshLibrary, showToast],
  );

  const handleBackToLibrary = useCallback(async () => {
    if (activeDoc) {
      await updateDocumentProgress(activeDoc.hash, {
        lastPage: currentPage,
        lastZoom: scale,
        lastOpenedAt: Date.now(),
      });
    }
    if (loadingTaskRef.current) {
      void loadingTaskRef.current.destroy();
      loadingTaskRef.current = null;
    }
    setPdfDoc(null);
    setActiveDoc(null);
    await refreshLibrary();
  }, [activeDoc, currentPage, scale, refreshLibrary]);

  // Persist reading page & zoom progress smoothly
  useEffect(() => {
    if (!activeDoc) return;
    const timer = window.setTimeout(() => {
      void updateDocumentProgress(activeDoc.hash, {
        lastPage: currentPage,
        lastZoom: scale,
        lastOpenedAt: Date.now(),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeDoc, currentPage, scale]);

  // Global window drag-and-drop for PDFs and .notesmax bundles
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounterRef.current += 1;
        setIsDraggingFile(true);
      }
    };
    const onDragLeave = () => {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDraggingFile(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
      if (e.dataTransfer?.files?.length) {
        const dropped = e.dataTransfer.files[0];
        if (
          dropped &&
          (dropped.name.toLowerCase().endsWith('.pdf') ||
            dropped.name.toLowerCase().endsWith('.notesmax') ||
            dropped.type === 'application/pdf')
        ) {
          void handleOpenFiles(e.dataTransfer.files);
        }
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleOpenFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeDoc) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && activeDoc && !isTyping) {
        e.preventDefault();
        if (e.shiftKey) {
          void redo(setDrawings);
        } else {
          void undo(setDrawings);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && activeDoc && !isTyping) {
        e.preventDefault();
        void redo(setDrawings);
        return;
      }

      if (isTyping) return;

      const lower = e.key.toLowerCase();
      if (lower === 'd') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      if (!activeDoc) return;

      if (lower === 'v') {
        setMode('select');
      } else if (lower === 'n') {
        setMode('notes');
      } else if (lower === 'c') {
        setMode('draw');
      } else if (e.key === '=' || e.key === '+') {
        setZoomMode('custom');
        setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)));
      } else if (e.key === '-') {
        setZoomMode('custom');
        setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)));
      } else if (e.key === 'Escape') {
        setFloatingHighlightId(null);
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDoc, toggleTheme, undo, redo]);

  // Highlight CRUD
  const handleCreateHighlight = useCallback(
    (pageNumber: number, rects: NormalizedRect[], quote: string) => {
      if (!activeDoc) return;
      const now = Date.now();
      const newHighlight: HighlightAnnotation = {
        id: createId(),
        docHash: activeDoc.hash,
        pageNumber,
        rects,
        quote,
        color: 'yellow',
        noteText: '',
        links: [],
        images: [],
        createdAt: now,
        updatedAt: now,
      };
      setHighlights((prev) => [...prev, newHighlight]);
      setFloatingHighlightId(newHighlight.id);
      setActiveHighlightId(newHighlight.id);
      void upsertHighlight(newHighlight);
    },
    [activeDoc],
  );

  const handleOpenNote = useCallback((highlightId: string) => {
    setActiveHighlightId(highlightId);
    setSidePanelTab('note');
    setIsSidePanelOpen(true);
    setFloatingHighlightId(null);
  }, []);

  const handleUpdateHighlight = useCallback(
    (id: string, patch: Partial<HighlightAnnotation>) => {
      setHighlights((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const updated = { ...h, ...patch };
          void upsertHighlight(updated);
          return updated;
        }),
      );
    },
    [],
  );

  const handleDeleteHighlight = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      if (activeHighlightId === id) setActiveHighlightId(null);
      if (floatingHighlightId === id) setFloatingHighlightId(null);
      void removeHighlight(id);
    },
    [activeHighlightId, floatingHighlightId],
  );

  // Drawing CRUD
  const handleAddStroke = useCallback(
    (stroke: DrawingStroke) => {
      setDrawings((prev) => [...prev, stroke]);
      recordAdd(stroke);
      void upsertDrawing(stroke);
    },
    [recordAdd],
  );

  const handleEraseStroke = useCallback(
    (stroke: DrawingStroke) => {
      setDrawings((prev) => prev.filter((s) => s.id !== stroke.id));
      recordRemove(stroke);
      void removeDrawing(stroke.id);
    },
    [recordRemove],
  );

  // Revision sidebar jump + flash pulse
  const handleSelectHighlightFromIndex = useCallback((item: HighlightAnnotation) => {
    setActiveHighlightId(item.id);
    setSidePanelTab('note');
    setScrollRequest({ page: item.pageNumber, nonce: Date.now() });
    setFlashingHighlightId(item.id);
    window.setTimeout(() => {
      setFlashingHighlightId((curr) => (curr === item.id ? null : curr));
    }, 1500);
  }, []);

  // Text Search across PDF pages
  useEffect(() => {
    if (!isSearchOpen || !pdfDoc) return;
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setActiveSearchIdx(0);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results: SearchResult[] = [];
        for (let p = 1; p <= pdfDoc.numPages; p += 1) {
          if (cancelled) return;
          let text = pageTextCacheRef.current.get(p);
          if (text === undefined) {
            const page = await pdfDoc.getPage(p);
            const content = await page.getTextContent();
            text = content.items
              .map((it) => ('str' in it ? it.str : ''))
              .join(' ');
            pageTextCacheRef.current.set(p, text);
          }

          const lowerText = text.toLowerCase();
          let fromIdx = 0;
          let matchCount = 0;
          while (true) {
            const idx = lowerText.indexOf(q, fromIdx);
            if (idx === -1) break;
            matchCount += 1;
            const snippetStart = Math.max(0, idx - 24);
            const snippetEnd = Math.min(text.length, idx + q.length + 36);
            results.push({
              pageNumber: p,
              matchIndexInPage: matchCount,
              snippet: text.slice(snippetStart, snippetEnd),
              query: q,
            });
            fromIdx = idx + q.length;
            if (results.length >= 250) break;
          }
          if (results.length >= 250) break;
        }
        if (!cancelled) {
          setSearchResults(results);
          setActiveSearchIdx(0);
          if (results.length > 0) {
            setScrollRequest({ page: results[0].pageNumber, nonce: Date.now() });
          }
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, searchQuery, pdfDoc]);

  const activeSearchMatchPage = useMemo(() => {
    if (!isSearchOpen || searchResults.length === 0) return null;
    return searchResults[activeSearchIdx]?.pageNumber ?? null;
  }, [isSearchOpen, searchResults, activeSearchIdx]);

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    const next = (activeSearchIdx + 1) % searchResults.length;
    setActiveSearchIdx(next);
    setScrollRequest({ page: searchResults[next].pageNumber, nonce: Date.now() });
  };

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return;
    const prev = (activeSearchIdx - 1 + searchResults.length) % searchResults.length;
    setActiveSearchIdx(prev);
    setScrollRequest({ page: searchResults[prev].pageNumber, nonce: Date.now() });
  };

  // Save .notesmax bundle
  const handleSaveNotesMax = useCallback(() => {
    if (!activeDoc) return;
    const blob = serializeNotesMaxBundle(
      { ...activeDoc, lastPage: currentPage, lastZoom: scale },
      highlights,
      drawings,
    );
    const baseName = activeDoc.fileName.replace(/\.pdf$/i, '');
    triggerBlobDownload(blob, `${baseName}.notesmax`);
    showToast(`Saved ${baseName}.notesmax`);
  }, [activeDoc, currentPage, scale, highlights, drawings, showToast]);

  // Export Annotated PDF via pdf-lib
  const handleExportAnnotatedPdf = useCallback(async () => {
    if (!activeDoc) return;
    setIsExportingPdf(true);
    try {
      const exportedBytes = await exportAnnotatedPdf(
        activeDoc.pdfData.slice(0),
        activeDoc.title,
        highlights,
        drawings,
      );
      const buffer = exportedBytes.buffer.slice(
        exportedBytes.byteOffset,
        exportedBytes.byteOffset + exportedBytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const baseName = activeDoc.fileName.replace(/\.pdf$/i, '');
      triggerBlobDownload(blob, `${baseName}_annotated.pdf`);
      showToast(`Exported ${baseName}_annotated.pdf`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setIsExportingPdf(false);
    }
  }, [activeDoc, highlights, drawings, showToast]);

  const handleZoomWheel = useCallback((deltaScale: number) => {
    setZoomMode('custom');
    setScale((s) => Math.min(3, Math.max(0.5, +(s + deltaScale).toFixed(2))));
  }, []);

  return (
    <div className="nm-surface-colors relative flex h-full w-full flex-col overflow-hidden bg-[var(--nm-bg)] text-[var(--nm-text)]">
      {!activeDoc || !pdfDoc ? (
        <div className="flex-1 overflow-y-auto">
          <LibraryView
            documents={libraryDocs}
            isLoading={isLibraryLoading}
            theme={themeComfort.theme}
            onToggleTheme={toggleTheme}
            onOpenPdfFiles={handleOpenFiles}
            onOpenSamplePdf={handleOpenSamplePdf}
            onSelectDocument={handleSelectLibraryDoc}
            onDeleteDocument={handleDeleteLibraryDoc}
          />
        </div>
      ) : (
        <>
          <WorkspaceHeader
            title={activeDoc.title}
            mode={mode}
            onChangeMode={(m) => {
              setMode(m);
              if (m === 'draw') setFloatingHighlightId(null);
            }}
            currentPage={currentPage}
            pageCount={pdfDoc.numPages}
            onJumpToPage={(page) => {
              setCurrentPage(page);
              setScrollRequest({ page, nonce: Date.now() });
            }}
            scale={scale}
            zoomMode={zoomMode}
            onZoomIn={() => {
              setZoomMode('custom');
              setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)));
            }}
            onZoomOut={() => {
              setZoomMode('custom');
              setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)));
            }}
            onSelectZoomPreset={(zMode, presetScale) => {
              setZoomMode(zMode);
              if (presetScale !== undefined) setScale(presetScale);
            }}
            themeComfort={themeComfort}
            onToggleTheme={toggleTheme}
            onToggleDimImages={toggleDimImages}
            onToggleWarmSepia={toggleWarmSepia}
            onToggleSearch={() => setIsSearchOpen((o) => !o)}
            isSidePanelOpen={isSidePanelOpen}
            onToggleSidePanel={() => {
              setIsSidePanelOpen((o) => {
                const next = !o;
                if (next && !activeHighlightId) {
                  setSidePanelTab('all');
                }
                return next;
              });
            }}
            noteBadgeCount={highlights.length}
            onSaveNotesMax={handleSaveNotesMax}
            onExportPdf={handleExportAnnotatedPdf}
            isExportingPdf={isExportingPdf}
            onBackToLibrary={handleBackToLibrary}
          />

          {/* Non-overlapping workspace flex container (PDF viewport + Docked Side Panel) */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Draw Sub-Bar anchored cleanly top-left under mode switcher */}
              <div className="pointer-events-none absolute top-3 left-3 z-30">
                <AnimatePresence>
                  {mode === 'draw' && (
                    <DrawSubBar
                      drawTool={drawTool}
                      onChangeDrawTool={setDrawTool}
                      drawColor={drawColor}
                      onChangeDrawColor={setDrawColor}
                      drawWidth={drawWidth}
                      onChangeDrawWidth={setDrawWidth}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={() => void undo(setDrawings)}
                      onRedo={() => void redo(setDrawings)}
                      isDark={themeComfort.theme === 'dark'}
                    />
                  )}
                </AnimatePresence>
              </div>

              <SearchBar
                isOpen={isSearchOpen}
                query={searchQuery}
                results={searchResults}
                activeIndex={activeSearchIdx}
                isSearching={isSearching}
                onChangeQuery={setSearchQuery}
                onNext={handleNextSearch}
                onPrev={handlePrevSearch}
                onClose={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              />

              <PdfViewer
                pdfDoc={pdfDoc}
                docHash={activeDoc.hash}
                scale={scale}
                zoomMode={zoomMode}
                onComputedScale={setScale}
                onZoomWheel={handleZoomWheel}
                onCurrentPageChange={setCurrentPage}
                scrollToPageRequest={scrollRequest}
                mode={mode}
                drawTool={drawTool}
                drawColor={drawColor}
                drawWidth={drawWidth}
                themeComfort={themeComfort}
                highlights={highlights}
                drawings={drawings}
                activeHighlightId={activeHighlightId}
                floatingHighlightId={floatingHighlightId}
                flashingHighlightId={flashingHighlightId}
                searchQuery={isSearchOpen ? searchQuery : ''}
                activeSearchMatchPage={activeSearchMatchPage}
                onCreateHighlight={handleCreateHighlight}
                onOpenNote={handleOpenNote}
                onChangeHighlightColor={(id, color) => handleUpdateHighlight(id, { color, updatedAt: Date.now() })}
                onDeleteHighlight={handleDeleteHighlight}
                onDismissFloating={() => setFloatingHighlightId(null)}
                onAddStroke={handleAddStroke}
                onEraseStroke={handleEraseStroke}
              />
            </div>

            <SideNotesPanel
              isOpen={isSidePanelOpen}
              activeTab={sidePanelTab}
              onChangeTab={setSidePanelTab}
              highlights={highlights}
              activeHighlightId={activeHighlightId}
              onSelectHighlightFromIndex={handleSelectHighlightFromIndex}
              onUpdateHighlight={handleUpdateHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onClosePanel={() => setIsSidePanelOpen(false)}
              onOpenImageLightbox={setLightboxImage}
            />

            <HelpGuideButton />
          </div>
        </>
      )}

      {/* Full-Screen Image Lightbox */}
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      {/* Global Drag-and-Drop Overlay */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs"
          >
            <div className="nm-glass-popover flex flex-col items-center gap-2.5 rounded-3xl border px-9 py-7 text-center">
              <FileUp className="h-8 w-8 text-[var(--nm-accent)]" />
              <p className="nm-heading text-[15px] font-semibold text-[var(--nm-text)]">
                Drop PDF or .notesmax bundle to open
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="nm-glass-popover pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-[13px] font-medium text-[var(--nm-text)]"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
