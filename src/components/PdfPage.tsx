import type { PDFDocumentProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DrawTool,
  DrawingStroke,
  HighlightAnnotation,
  StudyMode,
  ThemeComfortSettings,
} from '../types';
import { attachTextLayerSelectionGuard } from '../utils/textLayerSelectionGuard';
import { DrawingOverlay } from './DrawingOverlay';
import { HighlightOverlay } from './HighlightOverlay';

export interface HighlightClientAnchor {
  highlight: HighlightAnnotation;
  anchorRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  docHash: string;
  pageNumber: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
  scrollContainer: HTMLDivElement | null;
  mode: StudyMode;
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  themeComfort: ThemeComfortSettings;
  highlights: HighlightAnnotation[];
  drawings: DrawingStroke[];
  activeHighlightId: string | null;
  flashingHighlightId: string | null;
  searchQuery: string;
  activeSearchMatchPage: number | null;
  onRegisterElement: (pageNumber: number, el: HTMLDivElement | null) => void;
  onOpenNote: (highlightId: string) => void;
  onHoverHighlight: (anchor: HighlightClientAnchor | null) => void;
  onAddStroke: (stroke: DrawingStroke) => void;
  onEraseStroke: (stroke: DrawingStroke) => void;
}

function findHighlightAtPoint(
  highlights: HighlightAnnotation[],
  nx: number,
  ny: number,
): HighlightAnnotation | null {
  const padX = 0.004;
  const padY = 0.004;
  for (let i = highlights.length - 1; i >= 0; i -= 1) {
    const h = highlights[i];
    for (const r of h.rects) {
      if (
        nx >= r.x - padX &&
        nx <= r.x + r.width + padX &&
        ny >= r.y - padY &&
        ny <= r.y + r.height + padY
      ) {
        return h;
      }
    }
  }
  return null;
}

export function getHighlightAnchorRect(
  pageEl: HTMLElement,
  highlight: HighlightAnnotation,
): HighlightClientAnchor['anchorRect'] | null {
  const first = highlight.rects[0];
  if (!first) return null;
  const box = pageEl.getBoundingClientRect();
  return {
    left: box.left + first.x * box.width,
    top: box.top + first.y * box.height,
    width: first.width * box.width,
    height: first.height * box.height,
  };
}

export function PdfPage({
  pdfDoc,
  docHash,
  pageNumber,
  scale,
  baseWidth,
  baseHeight,
  scrollContainer,
  mode,
  drawTool,
  drawColor,
  drawWidth,
  themeComfort,
  highlights,
  drawings,
  activeHighlightId,
  flashingHighlightId,
  searchQuery,
  activeSearchMatchPage,
  onRegisterElement,
  onOpenNote,
  onHoverHighlight,
  onAddStroke,
  onEraseStroke,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 3);
  const [isRendered, setIsRendered] = useState(false);

  const pageWidth = Math.max(1, Math.round(baseWidth * scale));
  const pageHeight = Math.max(1, Math.round(baseHeight * scale));

  // Virtualized rendering via IntersectionObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting);
        }
      },
      {
        root: scrollContainer,
        rootMargin: '700px 0px',
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollContainer]);

  // Double-buffered offscreen canvas + TextLayer with official PDF.js endOfContent selection guard
  useEffect(() => {
    if (!isVisible) {
      setIsRendered(false);
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayerInstance: TextLayer | null = null;
    let detachSelectionGuard: (() => void) | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const targetCanvas = canvasRef.current;
        const textDiv = textLayerRef.current;
        if (!targetCanvas || !textDiv) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        bufferCanvas.height = Math.max(1, Math.floor(viewport.height * dpr));

        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
        renderTask = page.render({
          canvas: bufferCanvas,
          viewport,
          transform,
        });

        await renderTask.promise;
        if (cancelled) return;

        targetCanvas.width = bufferCanvas.width;
        targetCanvas.height = bufferCanvas.height;
        const ctx = targetCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bufferCanvas, 0, 0);
        }

        textDiv.replaceChildren();
        textDiv.style.setProperty('--scale-factor', String(viewport.scale));
        textDiv.style.setProperty('--total-scale-factor', String(viewport.scale));

        const textContent = await page.getTextContent();
        if (cancelled) return;

        textLayerInstance = new TextLayer({
          textContentSource: textContent,
          container: textDiv,
          viewport,
        });
        await textLayerInstance.render();
        if (cancelled) return;

        detachSelectionGuard = attachTextLayerSelectionGuard(textDiv);
        setIsRendered(true);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name !== 'RenderingCancelledException' && name !== 'AbortException') {
          // Ignore benign cancellation errors
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayerInstance?.cancel();
      detachSelectionGuard?.();
    };
  }, [isVisible, pdfDoc, pageNumber, scale]);

  // Highlight search query matches inside rendered textLayer spans
  useEffect(() => {
    const textDiv = textLayerRef.current;
    if (!textDiv || !isRendered) return;

    const q = searchQuery.trim().toLowerCase();
    const spans = textDiv.querySelectorAll('span');
    const isCurrentMatchPage = activeSearchMatchPage === pageNumber;

    spans.forEach((span) => {
      const text = (span.textContent ?? '').toLowerCase();
      if (q && text.includes(q)) {
        span.style.backgroundColor = isCurrentMatchPage
          ? 'rgba(245, 158, 11, 0.44)'
          : 'rgba(194, 65, 12, 0.28)';
        span.style.borderRadius = '3px';
      } else {
        span.style.backgroundColor = '';
        span.style.borderRadius = '';
      }
    });
  }, [searchQuery, activeSearchMatchPage, pageNumber, isRendered]);

  const canvasFilterClass = useMemo(() => {
    const classes = ['pdf-canvas-layer', 'h-full', 'w-full'];
    if (themeComfort.theme === 'dark') {
      classes.push('pdf-canvas-dark');
      if (themeComfort.dimImagesInDark) classes.push('pdf-dim-images');
      if (themeComfort.warmSepiaTint) classes.push('pdf-sepia-tint');
    } else {
      classes.push('pdf-canvas-light');
      if (themeComfort.warmSepiaTint) classes.push('pdf-sepia-tint');
    }
    return classes.join(' ');
  }, [themeComfort]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'draw' || e.buttons !== 0 || highlights.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const nx = (e.clientX - box.left) / box.width;
    const ny = (e.clientY - box.top) / box.height;

    const hit = findHighlightAtPoint(highlights, nx, ny);
    if (
      hit &&
      (hit.noteText.trim().length > 0 || hit.links.length > 0 || hit.images.length > 0)
    ) {
      const anchorRect = getHighlightAnchorRect(el, hit);
      if (anchorRect) {
        onHoverHighlight({ highlight: hit, anchorRect });
        return;
      }
    }
    onHoverHighlight(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'draw' || highlights.length === 0) return;

    // Never treat a text-selection drag as a highlight click (even after selection is cleared on mouseup)
    const downPos = mouseDownPosRef.current;
    mouseDownPosRef.current = null;
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 4) {
      return;
    }

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

    const el = containerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const nx = (e.clientX - box.left) / box.width;
    const ny = (e.clientY - box.top) / box.height;

    const hit = findHighlightAtPoint(highlights, nx, ny);
    if (hit) {
      e.stopPropagation();
      onOpenNote(hit.id);
    }
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        onRegisterElement(pageNumber, el);
      }}
      data-page-number={pageNumber}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverHighlight(null)}
      onClick={handleClick}
      style={
        {
          width: pageWidth,
          height: pageHeight,
          boxShadow: 'var(--nm-page-shadow)',
          '--scale-factor': String(scale),
          '--total-scale-factor': String(scale),
        } as React.CSSProperties
      }
      className={`pdf-page-container relative mx-auto my-5 shrink-0 rounded-[6px] ${
        themeComfort.theme === 'dark' ? 'bg-[#141418]' : 'bg-white'
      }`}
    >
      {/* Layer 1: PDF Canvas (the ONLY layer receiving dark-mode invert filter) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[6px]">
        {isVisible ? (
          <canvas
            ref={canvasRef}
            className={`${canvasFilterClass} ${isRendered ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono-num text-xs text-[var(--nm-text-muted)]">
            Page {pageNumber}
          </div>
        )}
      </div>

      {/* Layer 2: True-color Highlights (pointer-events: none so text selection is never blocked) */}
      <HighlightOverlay
        highlights={highlights}
        isDark={themeComfort.theme === 'dark'}
        activeHighlightId={activeHighlightId}
        flashingHighlightId={flashingHighlightId}
      />

      {/* Layer 3: PDF.js TextLayer (unobstructed in Read & Notes modes) */}
      <div
        ref={textLayerRef}
        className={`textLayer z-15 ${mode === 'draw' ? 'pointer-events-none select-none' : ''}`}
      />

      {/* Layer 4: Vector Drawing / Circling Overlay (pointer-events: none outside Circle mode) */}
      <DrawingOverlay
        docHash={docHash}
        pageNumber={pageNumber}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        isActive={mode === 'draw'}
        drawTool={drawTool}
        drawColor={drawColor}
        drawWidth={drawWidth}
        strokes={drawings}
        onAddStroke={onAddStroke}
        onEraseStroke={onEraseStroke}
      />

      {/* Subtle page number badge */}
      <div className="pointer-events-none absolute right-2.5 bottom-2 z-11 rounded px-1.5 py-0.5 font-mono-num text-[10px] text-[var(--nm-text-muted)] opacity-60">
        {pageNumber}
      </div>
    </div>
  );
}
