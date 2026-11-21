import Dexie, { type Table } from 'dexie';
import type {
  DrawingStroke,
  HighlightAnnotation,
  LibraryDocumentSummary,
  StudyDocument,
} from '../types';

class NotesMaxxingDB extends Dexie {
  documents!: Table<StudyDocument, string>;
  highlights!: Table<HighlightAnnotation, string>;
  drawings!: Table<DrawingStroke, string>;

  constructor() {
    super('NotesMaxxingDB');
    this.version(1).stores({
      documents: '&hash, lastOpenedAt, createdAt',
      highlights: '&id, docHash, pageNumber, [docHash+pageNumber], createdAt',
      drawings: '&id, docHash, pageNumber, [docHash+pageNumber], createdAt',
    });
  }
}

export const db = new NotesMaxxingDB();

export async function getLibrarySummaries(): Promise<LibraryDocumentSummary[]> {
  const docs = await db.documents.orderBy('lastOpenedAt').reverse().toArray();
  const summaries = await Promise.all(
    docs.map(async (doc) => {
      const [highlights, drawingCount] = await Promise.all([
        db.highlights.where('docHash').equals(doc.hash).toArray(),
        db.drawings.where('docHash').equals(doc.hash).count(),
      ]);
      const noteCount = highlights.filter(
        (h) => h.noteText.trim().length > 0 || h.links.length > 0 || h.images.length > 0,
      ).length;

      return {
        hash: doc.hash,
        title: doc.title,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        thumbnailDataUrl: doc.thumbnailDataUrl,
        lastPage: doc.lastPage,
        lastZoom: doc.lastZoom,
        createdAt: doc.createdAt,
        lastOpenedAt: doc.lastOpenedAt,
        highlightCount: highlights.length,
        noteCount,
        drawingCount,
      };
    }),
  );
  return summaries;
}

export async function getDocumentWithAnnotations(hash: string): Promise<{
  document: StudyDocument;
  highlights: HighlightAnnotation[];
  drawings: DrawingStroke[];
} | null> {
  const document = await db.documents.get(hash);
  if (!document) return null;

  const [highlights, drawings] = await Promise.all([
    db.highlights.where('docHash').equals(hash).toArray(),
    db.drawings.where('docHash').equals(hash).toArray(),
  ]);

  await db.documents.update(hash, { lastOpenedAt: Date.now() });
  return { document, highlights, drawings };
}

export async function upsertDocument(doc: StudyDocument): Promise<void> {
  await db.documents.put(doc);
}

export async function updateDocumentProgress(
  hash: string,
  patch: Partial<Pick<StudyDocument, 'lastPage' | 'lastZoom' | 'lastOpenedAt' | 'thumbnailDataUrl' | 'title'>>,
): Promise<void> {
  await db.documents.update(hash, patch);
}

export async function deleteDocumentAndAnnotations(hash: string): Promise<void> {
  await db.transaction('rw', db.documents, db.highlights, db.drawings, async () => {
    await db.highlights.where('docHash').equals(hash).delete();
    await db.drawings.where('docHash').equals(hash).delete();
    await db.documents.delete(hash);
  });
}

export async function upsertHighlight(highlight: HighlightAnnotation): Promise<void> {
  await db.highlights.put(highlight);
}

export async function removeHighlight(id: string): Promise<void> {
  await db.highlights.delete(id);
}

export async function upsertDrawing(stroke: DrawingStroke): Promise<void> {
  await db.drawings.put(stroke);
}

export async function removeDrawing(id: string): Promise<void> {
  await db.drawings.delete(id);
}

export async function restoreBundleToDb(
  document: StudyDocument,
  highlights: HighlightAnnotation[],
  drawings: DrawingStroke[],
): Promise<void> {
  await db.transaction('rw', db.documents, db.highlights, db.drawings, async () => {
    await db.documents.put(document);
    await db.highlights.where('docHash').equals(document.hash).delete();
    await db.drawings.where('docHash').equals(document.hash).delete();
    if (highlights.length > 0) {
      await db.highlights.bulkPut(highlights);
    }
    if (drawings.length > 0) {
      await db.drawings.bulkPut(drawings);
    }
  });
}
