import { useCallback, useRef, useState } from 'react';

type UseFileDropOpts = {
  onFiles: (files: File[]) => Promise<void>;
};

export function useFileDrop({ onFiles }: UseFileDropOpts) {
  const [dragover, setDragover] = useState(false);
  const counter = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    counter.current++;
    setDragover(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    counter.current--;
    if (counter.current <= 0) {
      counter.current = 0;
      setDragover(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    counter.current = 0;
    setDragover(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  }, [onFiles]);

  return { dragover, handlers: { onDragEnter, onDragLeave, onDragOver, onDrop } };
}
