import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  DrawTool,
  DrawingStroke,
  HighlightAnnotation,
  HighlightColor,
  NormalizedRect,
  StudyMode,
  ThemeComfortSettings,
  ZoomMode,
} from '../types';
import { extractNormalizedRectsFromRange } from '../utils/selectionRects';
import {
  HighlightPopoverPortal,
  type PopoverAnchor,
} from './HighlightPopoverPortal';
import {
  PdfPage,
  getHighlightAnchorRect,
  type HighlightClientAnchor,
} from './PdfPage';

interface PageDims {
  width: number;
  height: number;
}

interface PdfViewerProps {
  pdfDoc: PDFDocumentProxy;
  docHash: string;
  scale: number;
  zoomMode: ZoomMode;
  onComputedScale: (newScale: number) => void;
  onZoomWheel: (deltaScale: number) => void;
  onCurrentPageChange: (page: number) => void;
  scrollToPageRequest: { page: number; nonce: number } | null;
  mode: StudyMode;
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  themeComfort: ThemeComfortSettings;
  highlights: HighlightAnnotation[];
  drawings: DrawingStroke[];
  activeHighlightId: string | null;
  floatingHighlightId: string | null;
  flashingHighlightId: string | null;
  searchQuery: string;
  activeSearchMatchPage: number | null;
  onCreateHighlight: (pageNumber: number, rects: NormalizedRect[], quote: string) => void;
  onOpenNote: (highlightId: string) => void;
  onChangeHighlightColor: (highlightId: string, color: HighlightColor) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onDismissFloating: () => void;
  onAddStroke: (stroke: DrawingStroke) => void;
  onEraseStroke: (stroke: DrawingStroke) => void;
}

export function PdfViewer({
  pdfDoc,
  docHash,
  scale,
  zoomMode,
  onComputedScale,
  onZoomWheel,
  onCurrentPageChange,
  scrollToPageRequest,
  mode,
  drawTool,
  drawColor,
  drawWidth,
  themeComfort,
  highlights,
  drawings,
  activeHighlightId,
  floatingHighlightId,
  flashingHighlightId,
  searchQuery,
  activeSearchMatchPage,
  onCreateHighlight,
  onOpenNote,
  onChangeHighlightColor,
  onDeleteHighlight,
  onDismissFloating,
  onAddStroke,
  onEraseStroke,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const [pageDims, setPageDims] = useState<PageDims[]>([]);

  // Two-stage smooth zoom: instant visualScale CSS transform + 240ms debounced crisp renderScale
  const [renderScale, setRenderScale] = useState(scale);
  const prevRenderScaleRef = useRef(scale);
  const lastDocHashRef = useRef(docHash);

  // Portal popover anchors (outside zoomed transform wrapper for 100% razor-sharp icons)
  const [floatingAnchor, setFloatingAnchor] = useState<PopoverAnchor | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<PopoverAnchor | null>(null);
  const hoverHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastDocHashRef.current !== docHash) {
      lastDocHashRef.current = docHash;
      prevRenderScaleRef.current = scale;
      setRenderScale(scale);
      return;
    }

    if (Math.abs(scale - renderScale) < 0.002) return;
    const timer = window.setTimeout(() => {
      setRenderScale(scale);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [scale, renderScale, docHash]);

  // Preserve vertical scroll anchor seamlessly when debounced renderScale settles
  useLayoutEffect(() => {
    const prev = prevRenderScaleRef.current;
    if (prev > 0 && Math.abs(renderScale - prev) > 0.002 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollTop * (renderScale / prev);
    }
    prevRenderScaleRef.current = renderScale;
  }, [renderScale]);

  // Load unscaled page dimensions upfront
  useEffect(() => {
    let cancelled = false;
    const loadDims = async () => {
      const dims: PageDims[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i += 1) {
        const page = await pdfDoc.getPage(i);
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        dims.push({ width: vp.width, height: vp.height });
      }
      if (!cancelled) setPageDims(dims);
    };
    void loadDims();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  // Smart-Fit / Fit Width / Fit Page calculation
  useEffect(() => {
    const el = scrollContainerEl;
    if (!el || pageDims.length === 0 || zoomMode === 'custom') return;

    const recalc = () => {
      const refDim = pageDims[0];
      if (!refDim) return;
      const availW = Math.max(240, el.clientWidth - 48);
      const availH = Math.max(240, el.clientHeight - 48);
      if (zoomMode === 'smart-fit') {
        const targetFill = availW < 760 ? 0.92 : 0.82;
        const next = Math.min(2.35, Math.max(0.85, (availW * targetFill) / refDim.width));
        onComputedScale(Number(next.toFixed(2)));
      } else if (zoomMode === 'fit-width') {
        const next = Math.min(3, Math.max(0.5, availW / refDim.width));
        onComputedScale(Number(next.toFixed(2)));
      } else if (zoomMode === 'fit-page') {
        const next = Math.min(3, Math.max(0.5, Math.min(availW / refDim.width, availH / refDim.height)));
        onComputedScale(Number(next.toFixed(2)));
      }
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollContainerEl, pageDims, zoomMode, onComputedScale]);

  // Ctrl + Wheel zoom
  useEffect(() => {
    const el = scrollContainerEl;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.12 : -0.12;
        onZoomWheel(step);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [scrollContainerEl, onZoomWheel]);

  // Track most-visible page as user scrolls
  useEffect(() => {
    const el = scrollContainerEl;
    if (!el || pageDims.length === 0) return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const num = Number((entry.target as HTMLElement).dataset.pageNumber);
          if (!Number.isNaN(num)) {
            ratios.set(num, entry.intersectionRatio);
          }
        }
        let bestPage = 1;
        let bestRatio = -1;
        for (const [page, ratio] of ratios.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = page;
          }
        }
        if (bestRatio > 0) {
          onCurrentPageChange(bestPage);
        }
      },
      {
        root: el,
        threshold: [0.1, 0.3, 0.55, 0.8],
      },
    );

    for (const pageEl of pageElementsRef.current.values()) {
      observer.observe(pageEl);
    }

    return () => observer.disconnect();
  }, [scrollContainerEl, pageDims.length, onCurrentPageChange]);

  // Smooth jump to requested page
  useEffect(() => {
    if (!scrollToPageRequest) return;
    const target = pageElementsRef.current.get(scrollToPageRequest.page);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToPageRequest]);

  // Recompute floating popover portal anchor whenever floatingHighlightId, highlights, scale, or scroll changes
  const updateFloatingAnchor = useCallback(() => {
    if (!floatingHighlightId || mode === 'draw') {
      setFloatingAnchor(null);
      return;
    }
    const target = highlights.find((h) => h.id === floatingHighlightId);
    if (!target) {
      setFloatingAnchor(null);
      return;
    }
    const pageEl = pageElementsRef.current.get(target.pageNumber);
    if (!pageEl) {
      setFloatingAnchor(null);
      return;
    }
    const anchorRect = getHighlightAnchorRect(pageEl, target);
    if (!anchorRect) {
      setFloatingAnchor(null);
      return;
    }
    setFloatingAnchor({ highlight: target, anchorRect });
  }, [floatingHighlightId, highlights, mode]);

  useLayoutEffect(() => {
    updateFloatingAnchor();
  }, [updateFloatingAnchor, scale, renderScale]);

  useEffect(() => {
    const el = scrollContainerEl;
    if (!el) return;
    const onScroll = () => {
      updateFloatingAnchor();
      setHoverAnchor(null);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateFloatingAnchor);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateFloatingAnchor);
    };
  }, [scrollContainerEl, updateFloatingAnchor]);

  const registerPageElement = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) {
      pageElementsRef.current.set(pageNumber, el);
    } else {
      pageElementsRef.current.delete(pageNumber);
    }
  }, []);

  const highlightsByPage = useMemo(() => {
    const map = new Map<number, HighlightAnnotation[]>();
    for (const h of highlights) {
      const arr = map.get(h.pageNumber);
      if (arr) arr.push(h);
      else map.set(h.pageNumber, [h]);
    }
    return map;
  }, [highlights]);

  const drawingsByPage = useMemo(() => {
    const map = new Map<number, DrawingStroke[]>();
    for (const d of drawings) {
      const arr = map.get(d.pageNumber);
      if (arr) arr.push(d);
      else map.set(d.pageNumber, [d]);
    }
    return map;
  }, [drawings]);

  const handleHoverHighlight = useCallback((anchor: HighlightClientAnchor | null) => {
    if (hoverHideTimerRef.current) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    if (anchor) {
      setHoverAnchor(anchor);
    } else {
      hoverHideTimerRef.current = window.setTimeout(() => {
        setHoverAnchor(null);
      }, 170);
    }
  }, []);

  const cancelHoverHide = useCallback(() => {
    if (hoverHideTimerRef.current) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
  }, []);

  // Capture text selection immediately on mouseup when in Notes Mode (N)
  const handleMouseUp = () => {
    if (mode !== 'notes') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const quote = selection.toString().replace(/\0/g, '').replace(/\s+/g, ' ').trim();
    if (!quote) return;

    const range = selection.getRangeAt(0);
    const startNode =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement;

    const pageEl = startNode?.closest('.pdf-page-container') as HTMLElement | null;
    if (!pageEl) return;

    const pageNumber = Number(pageEl.dataset.pageNumber);
    if (!pageNumber || Number.isNaN(pageNumber)) return;

    const rects = extractNormalizedRectsFromRange(range, pageEl);
    if (rects.length === 0) return;

    selection.removeAllRanges();
    onCreateHighlight(pageNumber, rects, quote);
  };

  const zoomRatio = renderScale > 0 ? scale / renderScale : 1;
  const isAnimatingZoom = Math.abs(zoomRatio - 1) > 0.002;

  return (
    <div
      ref={(el) => {
        scrollContainerRef.current = el;
        setScrollContainerEl(el);
      }}
      onMouseUp={handleMouseUp}
      onMouseDown={() => {
        if (floatingHighlightId) onDismissFloating();
      }}
      className="nm-surface-colors relative flex-1 overflow-auto bg-[var(--nm-bg)] px-4 py-6"
    >
      <div
        style={{
          transform: isAnimatingZoom ? `scale(${zoomRatio})` : 'none',
          transformOrigin: 'top center',
          transition: isAnimatingZoom
            ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        }}
        className="flex min-w-fit flex-col items-center will-change-transform"
      >
        {pageDims.map((dim, idx) => {
          const pageNumber = idx + 1;
          return (
            <PdfPage
              key={`${docHash}-p-${pageNumber}`}
              pdfDoc={pdfDoc}
              docHash={docHash}
              pageNumber={pageNumber}
              scale={renderScale}
              baseWidth={dim.width}
              baseHeight={dim.height}
              scrollContainer={scrollContainerEl}
              mode={mode}
              drawTool={drawTool}
              drawColor={drawColor}
              drawWidth={drawWidth}
              themeComfort={themeComfort}
              highlights={highlightsByPage.get(pageNumber) ?? []}
              drawings={drawingsByPage.get(pageNumber) ?? []}
              activeHighlightId={activeHighlightId}
              flashingHighlightId={flashingHighlightId}
              searchQuery={searchQuery}
              activeSearchMatchPage={activeSearchMatchPage}
              onRegisterElement={registerPageElement}
              onOpenNote={onOpenNote}
              onHoverHighlight={handleHoverHighlight}
              onAddStroke={onAddStroke}
              onEraseStroke={onEraseStroke}
            />
          );
        })}
      </div>

      {/* Top-level Viewport Portal for Crisp Unscaled Highlight Popovers */}
      <HighlightPopoverPortal
        floatingAnchor={floatingAnchor}
        hoverAnchor={hoverAnchor}
        onHoverEnter={cancelHoverHide}
        onHoverLeave={() => handleHoverHighlight(null)}
        onOpenNote={(id) => {
          setHoverAnchor(null);
          onOpenNote(id);
        }}
        onChangeColor={onChangeHighlightColor}
        onDeleteHighlight={(id) => {
          setHoverAnchor(null);
          onDeleteHighlight(id);
        }}
        onDismissFloating={onDismissFloating}
      />
    </div>
  );
}
