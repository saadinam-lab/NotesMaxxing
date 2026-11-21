import { useCallback, useRef, useState } from 'react';
import type { DrawTool, DrawingStroke, EllipseGeometry, NormalizedPoint } from '../types';
import { createId } from '../utils/hash';

interface DrawingOverlayProps {
  docHash: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  isActive: boolean;
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
  onEraseStroke: (stroke: DrawingStroke) => void;
}

function buildSmoothSvgPath(points: NormalizedPoint[], w: number, h: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const x = points[0].x * w;
    const y = points[0].y * h;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + 0.5).toFixed(1)} ${(y + 0.5).toFixed(1)}`;
  }
  const first = points[0];
  let d = `M ${(first.x * w).toFixed(1)} ${(first.y * h).toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const next = points[i + 1];
    const midX = ((p.x + next.x) / 2) * w;
    const midY = ((p.y + next.y) / 2) * h;
    d += ` Q ${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${(last.x * w).toFixed(1)} ${(last.y * h).toFixed(1)}`;
  return d;
}

function computeEllipse(start: NormalizedPoint, end: NormalizedPoint, lockCircle: boolean): EllipseGeometry {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (lockCircle) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx >= 0 ? size : -size;
    dy = dy >= 0 ? size : -size;
  }
  const minX = Math.min(start.x, start.x + dx);
  const minY = Math.min(start.y, start.y + dy);
  const rx = Math.abs(dx) / 2;
  const ry = Math.abs(dy) / 2;
  return {
    cx: minX + rx,
    cy: minY + ry,
    rx,
    ry,
  };
}

export function DrawingOverlay({
  docHash,
  pageNumber,
  pageWidth,
  pageHeight,
  isActive,
  drawTool,
  drawColor,
  drawWidth,
  strokes,
  onAddStroke,
  onEraseStroke,
}: DrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDrawingRef = useRef(false);
  const isErasingRef = useRef(false);
  const erasedInDragRef = useRef<Set<string>>(new Set());

  const [draftPoints, setDraftPoints] = useState<NormalizedPoint[]>([]);
  const [draftEllipse, setDraftEllipse] = useState<EllipseGeometry | null>(null);
  const [hoveredStrokeId, setHoveredStrokeId] = useState<string | null>(null);
  const startPointRef = useRef<NormalizedPoint | null>(null);

  const getNormalizedPoint = useCallback((clientX: number, clientY: number): NormalizedPoint => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isActive || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (drawTool === 'eraser') {
      isErasingRef.current = true;
      erasedInDragRef.current.clear();
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    isDrawingRef.current = true;
    startPointRef.current = pt;

    if (drawTool === 'freehand') {
      setDraftPoints([pt]);
      setDraftEllipse(null);
    } else if (drawTool === 'ellipse') {
      setDraftPoints([]);
      setDraftEllipse({ cx: pt.x, cy: pt.y, rx: 0, ry: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isActive || !isDrawingRef.current) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);

    if (drawTool === 'freehand') {
      setDraftPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last) {
          const dist = Math.hypot((pt.x - last.x) * pageWidth, (pt.y - last.y) * pageHeight);
          if (dist < 2.2) return prev;
        }
        return [...prev, pt];
      });
    } else if (drawTool === 'ellipse' && startPointRef.current) {
      setDraftEllipse(computeEllipse(startPointRef.current, pt, e.shiftKey));
    }
  };

  const finishStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isErasingRef.current) {
      isErasingRef.current = false;
      erasedInDragRef.current.clear();
      return;
    }
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }

    if (drawTool === 'freehand' && draftPoints.length >= 2) {
      onAddStroke({
        id: createId(),
        docHash,
        pageNumber,
        kind: 'freehand',
        points: draftPoints,
        color: drawColor,
        strokeWidth: drawWidth,
        createdAt: Date.now(),
      });
    } else if (drawTool === 'ellipse' && draftEllipse) {
      const pixelW = draftEllipse.rx * 2 * pageWidth;
      const pixelH = draftEllipse.ry * 2 * pageHeight;
      if (pixelW >= 8 && pixelH >= 8) {
        onAddStroke({
          id: createId(),
          docHash,
          pageNumber,
          kind: 'ellipse',
          points: [],
          ellipse: draftEllipse,
          color: drawColor,
          strokeWidth: drawWidth,
          createdAt: Date.now(),
        });
      }
    }

    setDraftPoints([]);
    setDraftEllipse(null);
    startPointRef.current = null;
  };

  const tryEraseStroke = (stroke: DrawingStroke) => {
    if (!isActive || drawTool !== 'eraser') return;
    if (erasedInDragRef.current.has(stroke.id)) return;
    erasedInDragRef.current.add(stroke.id);
    onEraseStroke(stroke);
  };

  const cursorClass = !isActive
    ? 'pointer-events-none'
    : drawTool === 'eraser'
      ? 'cursor-cell'
      : 'cursor-crosshair';

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${Math.max(1, pageWidth)} ${Math.max(1, pageHeight)}`}
      className={`absolute inset-0 h-full w-full touch-none select-none ${
        isActive ? 'z-20' : 'z-10'
      } ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      {strokes.map((stroke) => {
        const pxWidth = Math.max(1.25, stroke.strokeWidth * pageWidth);
        const isHoveredForErase = isActive && drawTool === 'eraser' && hoveredStrokeId === stroke.id;
        const opacity = isHoveredForErase ? 0.35 : 0.92;

        if (stroke.kind === 'ellipse' && stroke.ellipse) {
          const { cx, cy, rx, ry } = stroke.ellipse;
          return (
            <g key={stroke.id}>
              <ellipse
                cx={cx * pageWidth}
                cy={cy * pageHeight}
                rx={rx * pageWidth}
                ry={ry * pageHeight}
                fill="none"
                stroke={stroke.color}
                strokeWidth={pxWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
                className={isActive && drawTool === 'eraser' ? 'pointer-events-stroke' : 'pointer-events-none'}
              />
              {isActive && drawTool === 'eraser' && (
                <ellipse
                  cx={cx * pageWidth}
                  cy={cy * pageHeight}
                  rx={rx * pageWidth}
                  ry={ry * pageHeight}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(16, pxWidth + 12)}
                  className="pointer-events-stroke cursor-pointer"
                  onPointerEnter={() => {
                    setHoveredStrokeId(stroke.id);
                    if (isErasingRef.current) tryEraseStroke(stroke);
                  }}
                  onPointerLeave={() => setHoveredStrokeId(null)}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    isErasingRef.current = true;
                    tryEraseStroke(stroke);
                  }}
                />
              )}
            </g>
          );
        }

        const pathD = buildSmoothSvgPath(stroke.points, pageWidth, pageHeight);
        return (
          <g key={stroke.id}>
            <path
              d={pathD}
              fill="none"
              stroke={stroke.color}
              strokeWidth={pxWidth}
              strokeOpacity={opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
            {isActive && drawTool === 'eraser' && (
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, pxWidth + 12)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-stroke cursor-pointer"
                onPointerEnter={() => {
                  setHoveredStrokeId(stroke.id);
                  if (isErasingRef.current) tryEraseStroke(stroke);
                }}
                onPointerLeave={() => setHoveredStrokeId(null)}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  isErasingRef.current = true;
                  tryEraseStroke(stroke);
                }}
              />
            )}
          </g>
        );
      })}

      {/* Live draft stroke */}
      {draftPoints.length >= 1 && (
        <path
          d={buildSmoothSvgPath(draftPoints, pageWidth, pageHeight)}
          fill="none"
          stroke={drawColor}
          strokeWidth={Math.max(1.25, drawWidth * pageWidth)}
          strokeOpacity={0.92}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none"
        />
      )}

      {draftEllipse && (draftEllipse.rx > 0 || draftEllipse.ry > 0) && (
        <ellipse
          cx={draftEllipse.cx * pageWidth}
          cy={draftEllipse.cy * pageHeight}
          rx={draftEllipse.rx * pageWidth}
          ry={draftEllipse.ry * pageHeight}
          fill="none"
          stroke={drawColor}
          strokeWidth={Math.max(1.25, drawWidth * pageWidth)}
          strokeOpacity={0.92}
          strokeDasharray="4 3"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}
