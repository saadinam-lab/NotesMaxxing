import type { NoteImage } from '../types';
import { createId } from './hash';

const MAX_DIMENSION = 1600;

export async function compressImageFile(file: File | Blob, fileName = 'pasted-image.webp'): Promise<NoteImage> {
  const bitmap = await loadImageElement(file);
  const { naturalWidth, naturalHeight } = bitmap;

  let targetWidth = naturalWidth || 1;
  let targetHeight = naturalHeight || 1;

  if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
      targetWidth = MAX_DIMENSION;
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
      targetHeight = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context for image compression.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  let dataUrl = canvas.toDataURL('image/webp', 0.84);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  }

  const cleanName = file instanceof File && file.name ? file.name : fileName;

  return {
    id: createId(),
    dataUrl,
    name: cleanName,
    width: targetWidth,
    height: targetHeight,
    createdAt: Date.now(),
  };
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode uploaded image.'));
    };
    img.src = objectUrl;
  });
}
