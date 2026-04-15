import { useState, useCallback, useRef } from 'react';

export function useDragReorder<T>(items: T[], onReorder: (items: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragItemRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(dropIndex, 0, moved);
    onReorder(updated);
    setDragIndex(null);
    setOverIndex(null);
    dragItemRef.current = null;
  }, [items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragItemRef.current = null;
  }, []);

  return {
    dragIndex,
    overIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
