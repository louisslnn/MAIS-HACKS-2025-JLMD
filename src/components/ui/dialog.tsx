"use client";

import { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Dialog({ open, onClose, children, title }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={handleClose}
      className="fixed left-1/2 top-1/2 z-50 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border-0 bg-transparent p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm focus:outline-none"
    >
      <div className="bg-surface max-h-[85vh] overflow-y-auto rounded-2xl p-6 space-y-4">
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">{title}</h2>
            <button
              onClick={handleClose}
              className="text-ink-soft hover:text-ink transition p-2 hover:bg-surface-muted rounded-lg"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
