import * as React from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ResizableDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogContent> {
  storageKey: string;
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  hideCloseButton?: boolean;
}

export function ResizableDialogContent({
  className,
  children,
  storageKey,
  initialWidth,
  initialHeight,
  minWidth = 300,
  minHeight = 300,
  maxWidth = 1200,
  maxHeight = 900,
  hideCloseButton = false,
  ...props
}: ResizableDialogContentProps) {
  const [width, setWidth] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}_width`);
      return saved ? Math.min(maxWidth, Math.max(minWidth, parseInt(saved))) : initialWidth;
    }
    return initialWidth;
  });
  const [height, setHeight] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}_height`);
      return saved ? Math.min(maxHeight, Math.max(minHeight, parseInt(saved))) : initialHeight;
    }
    return initialHeight;
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const savedX = localStorage.getItem(`${storageKey}_x`);
      const savedY = localStorage.getItem(`${storageKey}_y`);
      if (savedX && savedY) {
        return { x: parseInt(savedX), y: parseInt(savedY) };
      }
    }
    return { x: 0, y: 0 };
  });
  
  const startRef = React.useRef({ x: 0, y: 0, width: 0, height: 0, clientX: 0, clientY: 0 });
  const contentRef = React.useRef<HTMLDivElement>(null);

  const saveDimensions = React.useCallback((w: number, h: number) => {
    localStorage.setItem(`${storageKey}_width`, w.toString());
    localStorage.setItem(`${storageKey}_height`, h.toString());
  }, [storageKey]);

  // --- Resizing Logic ---
  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startRef.current.clientX;
    const deltaY = e.clientY - startRef.current.clientY;

    let newWidth = startRef.current.width + deltaX;
    let newHeight = startRef.current.height + deltaY;

    newWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
    newHeight = Math.min(maxHeight, Math.max(minHeight, newHeight));

    setWidth(newWidth);
    setHeight(newHeight);
  }, [isResizing, minWidth, minHeight, maxWidth, maxHeight]);

  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startRef.current = {
      x: position.x,
      y: position.y,
      width,
      height,
      clientX: e.clientX,
      clientY: e.clientY,
    };
  }, [width, height, position]);

  // --- Dragging Logic ---
  const handleDrag = React.useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startRef.current.clientX;
    const deltaY = e.clientY - startRef.current.clientY;

    setPosition({
      x: startRef.current.x + deltaX,
      y: startRef.current.y + deltaY,
    });
  }, [isDragging]);

  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    // Only start dragging if the mouse is down on the header area
    const target = e.target as HTMLElement;
    if (target.closest('.dialog-header-drag-area')) {
        e.preventDefault();
        setIsDragging(true);
        startRef.current = {
            x: position.x,
            y: position.y,
            width,
            height,
            clientX: e.clientX,
            clientY: e.clientY,
        };
    }
  }, [position, width, height]);

  const handleMouseUp = React.useCallback(() => {
    if (isResizing) {
      saveDimensions(width, height);
    }
    if (isDragging) {
      localStorage.setItem(`${storageKey}_x`, position.x.toString());
      localStorage.setItem(`${storageKey}_y`, position.y.toString());
    }
    setIsResizing(false);
    setIsDragging(false);
  }, [isResizing, isDragging, width, height, position, saveDimensions, storageKey]);

  React.useEffect(() => {
    if (isResizing || isDragging) {
      window.addEventListener('mousemove', isResizing ? handleResize : handleDrag);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizing ? 'nwse-resize' : 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing, isDragging, handleResize, handleDrag, handleMouseUp]);

  // Calculate dynamic style for the dialog content
  const dialogStyle: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    // Apply translation for dragging
    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
    // Override default dialog positioning
    top: '50%',
    left: '50%',
    margin: 0,
    // Ensure transition is off during interaction
    transition: (isResizing || isDragging) ? 'none' : undefined,
  };

  return (
    <DialogContent
      ref={contentRef}
      className={cn(
        "fixed p-0 flex flex-col",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "duration-200",
        className
      )}
      style={dialogStyle}
      {...props}
    >
      {/* Header Drag Area (to prevent dragging on interactive elements) */}
      <div 
        className="absolute inset-x-0 top-0 h-12 cursor-grab z-50 dialog-header-drag-area"
        onMouseDown={handleDragStart}
      />
      
      {/* Render children (Header, Body, Footer) */}
      {children}
      
      {/* Close Button Override */}
      {!hideCloseButton && (
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
          onClick={() => props.onOpenChange?.(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}

      {/* Resizer Handle (Bottom Right Corner) */}
      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize z-[100] transition-colors hover:bg-primary/20"
        onMouseDown={handleResizeStart}
        title="Arraste para redimensionar"
      />
    </DialogContent>
  );
}