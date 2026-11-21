/**
 * Implements Mozilla PDF.js TextLayerBuilder's `.endOfContent` + `selectionchange`
 * guard so dragging into whitespace between lines never jumps browser selection
 * to the top/bottom of the document, and Ctrl+C copies clean text.
 */

const registeredTextLayers = new Map<HTMLElement, HTMLDivElement>();
let globalAbortController: AbortController | null = null;
let isPointerDown = false;
let prevRange: Range | null = null;

function resetEndOfContent(endDiv: HTMLDivElement, textLayerDiv: HTMLElement) {
  if (textLayerDiv.isConnected) {
    textLayerDiv.append(endDiv);
  }
  endDiv.style.width = '';
  endDiv.style.height = '';
  textLayerDiv.classList.remove('selecting');
}

function ensureGlobalSelectionListener() {
  if (globalAbortController) return;
  globalAbortController = new AbortController();
  const { signal } = globalAbortController;

  document.addEventListener(
    'pointerdown',
    () => {
      isPointerDown = true;
    },
    { signal },
  );

  const resetAll = () => {
    isPointerDown = false;
    prevRange = null;
    registeredTextLayers.forEach((endDiv, textLayerDiv) => {
      resetEndOfContent(endDiv, textLayerDiv);
    });
  };

  document.addEventListener('pointerup', resetAll, { signal });
  window.addEventListener('blur', resetAll, { signal });
  document.addEventListener(
    'keyup',
    () => {
      if (!isPointerDown) resetAll();
    },
    { signal },
  );

  document.addEventListener(
    'selectionchange',
    () => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        registeredTextLayers.forEach((endDiv, textLayerDiv) => {
          resetEndOfContent(endDiv, textLayerDiv);
        });
        prevRange = null;
        return;
      }

      const activeTextLayers = new Set<HTMLElement>();
      for (let i = 0; i < selection.rangeCount; i += 1) {
        const range = selection.getRangeAt(i);
        if (range.collapsed && !isPointerDown) continue;
        for (const textLayerDiv of registeredTextLayers.keys()) {
          if (!activeTextLayers.has(textLayerDiv) && range.intersectsNode(textLayerDiv)) {
            activeTextLayers.add(textLayerDiv);
          }
        }
      }

      for (const [textLayerDiv, endDiv] of registeredTextLayers) {
        if (activeTextLayers.has(textLayerDiv)) {
          textLayerDiv.classList.add('selecting');
        } else {
          resetEndOfContent(endDiv, textLayerDiv);
        }
      }

      if (activeTextLayers.size === 0) {
        prevRange = null;
        return;
      }

      const range = selection.getRangeAt(0);
      const modifyStart =
        prevRange !== null &&
        (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
          range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);

      let anchor: Node | null = modifyStart ? range.startContainer : range.endContainer;
      if (anchor.nodeType === Node.TEXT_NODE) {
        anchor = anchor.parentNode;
      }

      if (!modifyStart && range.endOffset === 0 && anchor) {
        let safety = 0;
        while (anchor && !anchor.previousSibling && safety < 16) {
          anchor = anchor.parentNode;
          safety += 1;
        }
        anchor = anchor?.previousSibling ?? anchor;
      }

      const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
      const parentTextLayer = anchorEl?.closest('.textLayer') as HTMLElement | null;
      if (parentTextLayer && anchorEl?.parentElement) {
        const endDiv = registeredTextLayers.get(parentTextLayer);
        if (endDiv) {
          endDiv.style.width = parentTextLayer.style.width;
          endDiv.style.height = parentTextLayer.style.height;
          endDiv.style.userSelect = 'text';
          anchorEl.parentElement.insertBefore(
            endDiv,
            modifyStart ? anchorEl : anchorEl.nextSibling,
          );
        }
      }

      prevRange = range.cloneRange();
    },
    { signal },
  );
}

export function attachTextLayerSelectionGuard(textLayerDiv: HTMLElement): () => void {
  const endOfContent = document.createElement('div');
  endOfContent.className = 'endOfContent';
  textLayerDiv.append(endOfContent);

  registeredTextLayers.set(textLayerDiv, endOfContent);
  ensureGlobalSelectionListener();

  const onMouseDown = () => {
    textLayerDiv.classList.add('selecting');
  };

  const onCopy = (e: ClipboardEvent) => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) return;
    const cleaned = selection.toString().replace(/\0/g, '');
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', cleaned);
      e.preventDefault();
    }
  };

  textLayerDiv.addEventListener('mousedown', onMouseDown);
  textLayerDiv.addEventListener('copy', onCopy);

  return () => {
    textLayerDiv.removeEventListener('mousedown', onMouseDown);
    textLayerDiv.removeEventListener('copy', onCopy);
    registeredTextLayers.delete(textLayerDiv);
    endOfContent.remove();
    if (registeredTextLayers.size === 0 && globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
  };
}
