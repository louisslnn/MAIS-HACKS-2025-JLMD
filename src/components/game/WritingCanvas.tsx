"use client";

import { useRef, useEffect, useState, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui";

interface WritingCanvasProps {
  width?: number;
  height?: number;
  onClear?: () => void;
  className?: string;
}

/**
 * Canvas component for handwriting input with mouse/touch support
 */
export const WritingCanvas = forwardRef<HTMLCanvasElement, WritingCanvasProps>(function WritingCanvas({ 
  width = 600, 
  height = 150, 
  onClear,
  className = "" 
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Merge refs - use external ref if provided, otherwise internal
  const actualRef = (ref as React.RefObject<HTMLCanvasElement>) || canvasRef;
  const [isDrawing, setIsDrawing] = useState(false);
  // Fixed defaults: black pen, medium thickness
  const penColor = "#000000";
  const penThickness = 3;

  // Initialize canvas
  useEffect(() => {
    const canvas = actualRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Set drawing defaults
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [width, height, actualRef]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = actualRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Prevent default touch behavior (scrolling)
    if ("touches" in e) {
      e.preventDefault();
    }

    setIsDrawing(true);

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    // Use pageX/pageY for more accurate positioning with scrolling
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penThickness;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [penColor, penThickness, actualRef]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = actualRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();

    // Prevent scrolling on touch devices
    if ("touches" in e) {
      e.preventDefault();
    }
  }, [isDrawing, actualRef]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = actualRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and refill with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    onClear?.();
  }, [onClear, actualRef]);

  /**
   * Export canvas as base64 data URL
   */
  const exportAsBase64 = useCallback(() => {
    const canvas = actualRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }, [actualRef]);

  // Expose export method to parent via ref
  useEffect(() => {
    const canvas = actualRef.current;
    if (canvas) {
      // Add custom method to canvas element
      (canvas as any).exportAsBase64 = exportAsBase64;
    }
  }, [exportAsBase64, actualRef]);

  return (
    <div className={`${className} flex flex-col gap-2`}>
      <canvas
        ref={actualRef}
        className="border-2 border-border rounded-lg cursor-crosshair bg-white touch-none"
        style={{ touchAction: 'none' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />
      
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={clearCanvas}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
      </div>
    </div>
  );
});

// Export a function to get base64 from canvas ref
export function exportCanvasAsBase64(canvasRef: React.RefObject<HTMLCanvasElement>): string | null {
  if (!canvasRef.current) return null;
  return canvasRef.current.toDataURL("image/png");
}
