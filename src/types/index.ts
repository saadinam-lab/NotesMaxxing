export type WorkspaceTheme = 'dark' | 'light';

export type StudyMode = 'select' | 'notes' | 'draw';

export type DrawTool = 'freehand' | 'ellipse' | 'eraser';

export type HighlightColor = 'yellow' | 'mint' | 'coral' | 'sage';

export interface HighlightColorSpec {
  id: HighlightColor;
  label: string;
  swatch: string;
  fill: string;
  fillDark: string;
  underline: string;
  pdfRgb: [number, number, number];
}

export const HIGHLIGHT_COLORS: Record<HighlightColor, HighlightColorSpec> = {
  yellow: {
    id: 'yellow',
    label: 'Warm Amber',
    swatch: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.25)',
    fillDark: 'rgba(245, 158, 11, 0.28)',
    underline: '#C2410C',
    pdfRgb: [0.96, 0.62, 0.04],
  },
  mint: {
    id: 'mint',
    label: 'Mint',
    swatch: '#10B981',
    fill: 'rgba(16, 185, 129, 0.22)',
    fillDark: 'rgba(52, 211, 153, 0.25)',
    underline: '#059669',
    pdfRgb: [0.06, 0.73, 0.51],
  },
  coral: {
    id: 'coral',
    label: 'Terracotta',
    swatch: '#FB7185',
    fill: 'rgba(244, 63, 94, 0.22)',
    fillDark: 'rgba(251, 113, 133, 0.27)',
    underline: '#E11D48',
    pdfRgb: [0.96, 0.36, 0.45],
  },
  sage: {
    id: 'sage',
    label: 'Sage',
    swatch: '#84CC16',
    fill: 'rgba(132, 204, 22, 0.22)',
    fillDark: 'rgba(163, 230, 53, 0.24)',
    underline: '#65A30D',
    pdfRgb: [0.52, 0.80, 0.09],
  },
};

export const DRAW_COLORS = [
  { id: 'crimson', label: 'Crimson', value: '#EF4444' },
  { id: 'amber', label: 'Amber', value: '#F59E0B' },
  { id: 'terracotta', label: 'Terracotta', value: '#EA580C' },
  { id: 'sage', label: 'Sage', value: '#84CC16' },
  { id: 'ink', label: 'Ink', value: '#F4F4F5' },
] as const;

export const DRAW_WIDTHS = [
  { id: 'thin', label: 'Thin', value: 0.0022 },
  { id: 'medium', label: 'Medium', value: 0.004 },
  { id: 'thick', label: 'Thick', value: 0.0068 },
] as const;

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface YouTubeMetadata {
  videoId: string;
  timestampSeconds?: number;
  thumbnailUrl: string;
  canonicalUrl: string;
}

export interface NoteLink {
  id: string;
  url: string;
  title?: string;
  youtube?: YouTubeMetadata;
}

export interface NoteImage {
  id: string;
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface HighlightAnnotation {
  id: string;
  docHash: string;
  pageNumber: number;
  rects: NormalizedRect[];
  quote: string;
  color: HighlightColor;
  noteText: string;
  links: NoteLink[];
  images: NoteImage[];
  createdAt: number;
  updatedAt: number;
}

export interface EllipseGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface DrawingStroke {
  id: string;
  docHash: string;
  pageNumber: number;
  kind: 'freehand' | 'ellipse';
  points: NormalizedPoint[];
  ellipse?: EllipseGeometry;
  color: string;
  /** Normalized stroke width relative to page width (e.g. 0.0035) */
  strokeWidth: number;
  createdAt: number;
}

export interface StudyDocument {
  hash: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pdfData: ArrayBuffer;
  thumbnailDataUrl?: string;
  lastPage: number;
  lastZoom: number;
  createdAt: number;
  lastOpenedAt: number;
}

export interface LibraryDocumentSummary {
  hash: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  thumbnailDataUrl?: string;
  lastPage: number;
  lastZoom: number;
  createdAt: number;
  lastOpenedAt: number;
  highlightCount: number;
  noteCount: number;
  drawingCount: number;
}

export interface ThemeComfortSettings {
  theme: WorkspaceTheme;
  dimImagesInDark: boolean;
  warmSepiaTint: boolean;
}

export interface NotesMaxBundle {
  version: 1;
  app: 'NotesMaxxing';
  exportedAt: number;
  document: {
    hash: string;
    title: string;
    fileName: string;
    fileSize: number;
    pageCount: number;
    pdfBase64: string;
    thumbnailDataUrl?: string;
    lastPage: number;
    lastZoom: number;
  };
  highlights: HighlightAnnotation[];
  drawings: DrawingStroke[];
}

export type ZoomMode = 'smart-fit' | 'custom' | 'fit-width' | 'fit-page';

export interface SearchResult {
  pageNumber: number;
  matchIndexInPage: number;
  snippet: string;
  query: string;
}
