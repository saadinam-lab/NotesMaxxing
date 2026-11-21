import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { NoteImage } from '../types';

interface ImageLightboxProps {
  image: NoteImage | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [image?.id]);

  useEffect(() => {
    if (!image) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.35).toFixed(2)));
      if (e.key === '-') setZoom((z) => Math.max(0.5, +(z - 0.35).toFixed(2)));
      if (e.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [image, onClose]);

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#0C0C0E]/92 backdrop-blur-md"
          onClick={onClose}
        >
          <div
            className="flex h-14 items-center justify-between border-b border-white/10 bg-[#141418]/90 px-4 text-[#F4F4F5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-sm font-medium">{image.name}</span>
              <span className="font-mono-num text-xs text-[#A1A1AA]">
                {image.width}×{image.height}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.35).toFixed(2)))}
                className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-full text-[#A1A1AA] transition-colors duration-150 hover:bg-white/10 hover:text-[#F4F4F5]"
                title="Zoom Out (-)"
              >
                <ZoomOut className="h-[18px] w-[18px]" />
              </button>
              <span className="font-mono-num w-12 text-center text-xs text-[#F4F4F5]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.35).toFixed(2)))}
                className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-full text-[#A1A1AA] transition-colors duration-150 hover:bg-white/10 hover:text-[#F4F4F5]"
                title="Zoom In (+)"
              >
                <ZoomIn className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-full text-[#A1A1AA] transition-colors duration-150 hover:bg-white/10 hover:text-[#F4F4F5]"
                title="Reset Zoom (0)"
              >
                <RotateCcw className="h-[18px] w-[18px]" />
              </button>
              <div className="mx-1 h-4 w-px bg-white/10" />
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center rounded-full text-[#A1A1AA] transition-colors duration-150 hover:bg-white/10 hover:text-[#F4F4F5]"
                title="Close (Esc)"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          <div
            className="flex flex-1 items-center justify-center overflow-auto p-6"
            onWheel={(e) => {
              if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.2 : -0.2;
                setZoom((z) => Math.min(4, Math.max(0.5, +(z + delta).toFixed(2))));
              }
            }}
          >
            <motion.img
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={image.dataUrl}
              alt={image.name}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain transition-transform duration-150 select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
