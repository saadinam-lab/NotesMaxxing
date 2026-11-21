import { useCallback, useState } from 'react';
import type { DrawingStroke } from '../types';

type HistoryOp =
  | { type: 'add'; stroke: DrawingStroke }
  | { type: 'remove'; stroke: DrawingStroke };

interface UseUndoRedoDrawingsArgs {
  onPersistAdd: (stroke: DrawingStroke) => Promise<void>;
  onPersistRemove: (id: string) => Promise<void>;
}

export function useUndoRedoDrawings({
  onPersistAdd,
  onPersistRemove,
}: UseUndoRedoDrawingsArgs) {
  const [undoStack, setUndoStack] = useState<HistoryOp[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryOp[]>([]);

  const recordAdd = useCallback((stroke: DrawingStroke) => {
    setUndoStack((prev) => [...prev.slice(-49), { type: 'add', stroke }]);
    setRedoStack([]);
  }, []);

  const recordRemove = useCallback((stroke: DrawingStroke) => {
    setUndoStack((prev) => [...prev.slice(-49), { type: 'remove', stroke }]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(
    async (
      setDrawings: React.Dispatch<React.SetStateAction<DrawingStroke[]>>,
    ) => {
      if (undoStack.length === 0) return;
      const op = undoStack[undoStack.length - 1];
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, op]);

      if (op.type === 'add') {
        setDrawings((prev) => prev.filter((s) => s.id !== op.stroke.id));
        await onPersistRemove(op.stroke.id);
      } else {
        setDrawings((prev) => [...prev, op.stroke]);
        await onPersistAdd(op.stroke);
      }
    },
    [undoStack, onPersistAdd, onPersistRemove],
  );

  const redo = useCallback(
    async (
      setDrawings: React.Dispatch<React.SetStateAction<DrawingStroke[]>>,
    ) => {
      if (redoStack.length === 0) return;
      const op = redoStack[redoStack.length - 1];
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, op]);

      if (op.type === 'add') {
        setDrawings((prev) => [...prev, op.stroke]);
        await onPersistAdd(op.stroke);
      } else {
        setDrawings((prev) => prev.filter((s) => s.id !== op.stroke.id));
        await onPersistRemove(op.stroke.id);
      }
    },
    [redoStack, onPersistAdd, onPersistRemove],
  );

  const resetHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    recordAdd,
    recordRemove,
    undo,
    redo,
    resetHistory,
  };
}
