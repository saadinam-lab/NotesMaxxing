import type {
  DrawingStroke,
  HighlightAnnotation,
  NotesMaxBundle,
  StudyDocument,
} from '../types';

const CHUNK_SIZE = 0x8000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...slice));
  }
  return btoa(chunks.join(''));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function serializeNotesMaxBundle(
  document: StudyDocument,
  highlights: HighlightAnnotation[],
  drawings: DrawingStroke[],
): Blob {
  const payload: NotesMaxBundle = {
    version: 1,
    app: 'NotesMaxxing',
    exportedAt: Date.now(),
    document: {
      hash: document.hash,
      title: document.title,
      fileName: document.fileName,
      fileSize: document.fileSize,
      pageCount: document.pageCount,
      pdfBase64: arrayBufferToBase64(document.pdfData),
      thumbnailDataUrl: document.thumbnailDataUrl,
      lastPage: document.lastPage,
      lastZoom: document.lastZoom,
    },
    highlights,
    drawings,
  };

  const json = JSON.stringify(payload);
  return new Blob([json], { type: 'application/json' });
}

export async function parseNotesMaxBundle(file: File): Promise<{
  document: StudyDocument;
  highlights: HighlightAnnotation[];
  drawings: DrawingStroke[];
}> {
  const rawText = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid .notesmax file: unable to parse JSON payload.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as NotesMaxBundle).app !== 'NotesMaxxing' ||
    (parsed as NotesMaxBundle).version !== 1 ||
    !(parsed as NotesMaxBundle).document?.pdfBase64
  ) {
    throw new Error('Unrecognized .notesmax bundle format.');
  }

  const bundle = parsed as NotesMaxBundle;
  const pdfData = base64ToArrayBuffer(bundle.document.pdfBase64);
  const now = Date.now();

  const document: StudyDocument = {
    hash: bundle.document.hash,
    title: bundle.document.title || file.name.replace(/\.notesmax$/i, ''),
    fileName: bundle.document.fileName || `${bundle.document.title || 'study'}.pdf`,
    fileSize: bundle.document.fileSize || pdfData.byteLength,
    pageCount: bundle.document.pageCount || 1,
    pdfData,
    thumbnailDataUrl: bundle.document.thumbnailDataUrl,
    lastPage: bundle.document.lastPage || 1,
    lastZoom: bundle.document.lastZoom || 1.15,
    createdAt: now,
    lastOpenedAt: now,
  };

  const highlights: HighlightAnnotation[] = Array.isArray(bundle.highlights)
    ? bundle.highlights.map((h) => ({ ...h, docHash: document.hash }))
    : [];

  const drawings: DrawingStroke[] = Array.isArray(bundle.drawings)
    ? bundle.drawings.map((d) => ({ ...d, docHash: document.hash }))
    : [];

  return { document, highlights, drawings };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
