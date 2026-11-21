import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import {
  HIGHLIGHT_COLORS,
  type DrawingStroke,
  type HighlightAnnotation,
  type NormalizedPoint,
} from '../types';

function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) {
    return rgb(0.94, 0.27, 0.27);
  }
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

/**
 * Maps normalized viewport coordinates (0..1, top-left origin) into pdf-lib page coordinates
 * accounting for CropBox offset and 0/90/180/270 page rotation.
 */
function normalizedToPdfPoint(page: PDFPage, nx: number, ny: number): { x: number; y: number } {
  const box = page.getCropBox();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;

  if (angle === 90) {
    return {
      x: box.x + ny * box.width,
      y: box.y + nx * box.height,
    };
  }
  if (angle === 180) {
    return {
      x: box.x + (1 - nx) * box.width,
      y: box.y + ny * box.height,
    };
  }
  if (angle === 270) {
    return {
      x: box.x + (1 - ny) * box.width,
      y: box.y + (1 - nx) * box.height,
    };
  }
  return {
    x: box.x + nx * box.width,
    y: box.y + (1 - ny) * box.height,
  };
}

function normalizedRectToPdfBox(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const p1 = normalizedToPdfPoint(page, rect.x, rect.y);
  const p2 = normalizedToPdfPoint(page, rect.x + rect.width, rect.y + rect.height);
  const minX = Math.min(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  return {
    x: minX,
    y: minY,
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}

function attachStickyNoteAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  x: number,
  y: number,
  contents: string,
  color: RGB,
): void {
  const ctx = pdfDoc.context;
  const annotDict = ctx.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [x, y - 18, x + 18, y],
    Contents: PDFString.of(contents),
    T: PDFString.of('NotesMaxxing'),
    Name: 'Comment',
    Open: false,
    C: [
      (color as { red: number }).red,
      (color as { green: number }).green,
      (color as { blue: number }).blue,
    ],
  });
  const annotRef = ctx.register(annotDict);
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existing) {
    existing.push(annotRef);
  } else {
    page.node.set(PDFName.of('Annots'), ctx.obj([annotRef]));
  }
}

async function dataUrlToJpegBytes(dataUrl: string): Promise<{ bytes: Uint8Array; isPng: boolean }> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (match && (match[1] === 'image/jpeg' || match[1] === 'image/jpg' || match[1] === 'image/png')) {
    const bin = atob(match[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return { bytes, isPng: match[1] === 'image/png' };
  }

  // Convert WebP or other formats to JPEG using canvas so pdf-lib can embed it cleanly
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode attachment image for PDF export.'));
    el.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 1;
  canvas.height = img.naturalHeight || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable during PDF export.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = jpegDataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return { bytes, isPng: false };
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const sanitized = text.replace(/[^\x20-\x7E\n]/g, ' ');
  const paragraphs = sanitized.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export async function exportAnnotatedPdf(
  pdfData: ArrayBuffer,
  docTitle: string,
  highlights: HighlightAnnotation[],
  drawings: DrawingStroke[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // 1. Bake highlights & sticky notes onto original pages
  for (const highlight of highlights) {
    const page = pages[highlight.pageNumber - 1];
    if (!page) continue;

    const spec = HIGHLIGHT_COLORS[highlight.color] ?? HIGHLIGHT_COLORS.yellow;
    const color = rgb(spec.pdfRgb[0], spec.pdfRgb[1], spec.pdfRgb[2]);

    for (const rect of highlight.rects) {
      const box = normalizedRectToPdfBox(page, rect);
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color,
        opacity: 0.32,
      });

      const hasNoteContent =
        highlight.noteText.trim().length > 0 ||
        highlight.links.length > 0 ||
        highlight.images.length > 0;
      if (hasNoteContent) {
        page.drawLine({
          start: { x: box.x, y: box.y },
          end: { x: box.x + box.width, y: box.y },
          thickness: 1.2,
          color,
          opacity: 0.85,
        });
      }
    }

    const stickyParts: string[] = [];
    if (highlight.noteText.trim()) stickyParts.push(highlight.noteText.trim());
    if (highlight.links.length > 0) {
      stickyParts.push(
        `Links:\n${highlight.links.map((l) => `- ${l.title ? `${l.title}: ` : ''}${l.url}`).join('\n')}`,
      );
    }
    if (highlight.images.length > 0) {
      stickyParts.push(`[${highlight.images.length} attached image(s) included in Study Notes Appendix]`);
    }

    if (stickyParts.length > 0 && highlight.rects.length > 0) {
      const first = normalizedRectToPdfBox(page, highlight.rects[0]);
      attachStickyNoteAnnotation(
        pdfDoc,
        page,
        first.x + first.width + 4,
        first.y + first.height,
        stickyParts.join('\n\n'),
        color,
      );
    }
  }

  // 2. Bake drawings (freehand strokes & ellipses)
  for (const stroke of drawings) {
    const page = pages[stroke.pageNumber - 1];
    if (!page) continue;

    const cropBox = page.getCropBox();
    const thickness = Math.max(0.8, stroke.strokeWidth * cropBox.width);
    const color = hexToRgb(stroke.color);

    if (stroke.kind === 'ellipse' && stroke.ellipse) {
      const { cx, cy, rx, ry } = stroke.ellipse;
      const steps = 48;
      const ring: NormalizedPoint[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const theta = (i / steps) * Math.PI * 2;
        ring.push({
          x: cx + Math.cos(theta) * rx,
          y: cy + Math.sin(theta) * ry,
        });
      }
      for (let i = 0; i < ring.length - 1; i += 1) {
        const start = normalizedToPdfPoint(page, ring[i].x, ring[i].y);
        const end = normalizedToPdfPoint(page, ring[i + 1].x, ring[i + 1].y);
        page.drawLine({ start, end, thickness, color, opacity: 0.92 });
      }
    } else if (stroke.points.length >= 2) {
      for (let i = 0; i < stroke.points.length - 1; i += 1) {
        const start = normalizedToPdfPoint(page, stroke.points[i].x, stroke.points[i].y);
        const end = normalizedToPdfPoint(page, stroke.points[i + 1].x, stroke.points[i + 1].y);
        page.drawLine({ start, end, thickness, color, opacity: 0.92 });
      }
    }
  }

  // 3. Append clean Study Notes Appendix if there are any notes, links, or images
  const notedHighlights = [...highlights]
    .filter(
      (h) =>
        h.noteText.trim().length > 0 || h.links.length > 0 || h.images.length > 0 || h.quote.trim().length > 0,
    )
    .sort((a, b) => a.pageNumber - b.pageNumber || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));

  if (notedHighlights.length > 0) {
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;

    let appPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < margin) {
        appPage = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
    };

    appPage.drawText('NotesMaxxing — Study Notes Appendix', {
      x: margin,
      y: cursorY,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.12),
    });
    cursorY -= 20;
    appPage.drawText(`Document: ${docTitle.replace(/[^\x20-\x7E]/g, ' ')}`, {
      x: margin,
      y: cursorY,
      size: 10,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.5),
    });
    cursorY -= 24;

    for (const item of notedHighlights) {
      ensureSpace(72);

      const spec = HIGHLIGHT_COLORS[item.color] ?? HIGHLIGHT_COLORS.yellow;
      const accent = rgb(spec.pdfRgb[0], spec.pdfRgb[1], spec.pdfRgb[2]);

      appPage.drawRectangle({
        x: margin,
        y: cursorY - 2,
        width: 4,
        height: 12,
        color: accent,
      });
      appPage.drawText(`Page ${item.pageNumber} (${spec.label})`, {
        x: margin + 10,
        y: cursorY,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.18),
      });
      cursorY -= 16;

      if (item.quote.trim()) {
        const quoteLines = wrapTextLines(`"${item.quote.trim()}"`, 86);
        for (const line of quoteLines) {
          ensureSpace(14);
          appPage.drawText(line, {
            x: margin + 10,
            y: cursorY,
            size: 9.5,
            font: fontRegular,
            color: rgb(0.38, 0.38, 0.42),
          });
          cursorY -= 13;
        }
        cursorY -= 4;
      }

      if (item.noteText.trim()) {
        const noteLines = wrapTextLines(item.noteText.trim(), 84);
        for (const line of noteLines) {
          ensureSpace(14);
          appPage.drawText(line, {
            x: margin + 10,
            y: cursorY,
            size: 10,
            font: fontRegular,
            color: rgb(0.1, 0.1, 0.12),
          });
          cursorY -= 14;
        }
        cursorY -= 4;
      }

      for (const link of item.links) {
        ensureSpace(15);
        const label = link.title ? `${link.title} — ${link.url}` : link.url;
        appPage.drawText(`Link: ${label.replace(/[^\x20-\x7E]/g, ' ')}`.slice(0, 96), {
          x: margin + 10,
          y: cursorY,
          size: 9,
          font: fontRegular,
          color: rgb(0.76, 0.25, 0.05),
        });
        cursorY -= 13;
      }

      for (const img of item.images) {
        try {
          const { bytes, isPng } = await dataUrlToJpegBytes(img.dataUrl);
          const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const maxW = Math.min(contentWidth - 16, 360);
          const scale = Math.min(1, maxW / embedded.width, 220 / embedded.height);
          const drawW = embedded.width * scale;
          const drawH = embedded.height * scale;
          ensureSpace(drawH + 14);
          appPage.drawImage(embedded, {
            x: margin + 10,
            y: cursorY - drawH,
            width: drawW,
            height: drawH,
          });
          cursorY -= drawH + 10;
        } catch {
          // Skip unembeddable image gracefully
        }
      }

      cursorY -= 12;
      ensureSpace(10);
      appPage.drawLine({
        start: { x: margin, y: cursorY + 4 },
        end: { x: pageWidth - margin, y: cursorY + 4 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.88),
      });
      cursorY -= 10;
    }
  }

  return pdfDoc.save();
}
