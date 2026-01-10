import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AccountCard } from "./AccountCard";
import { AccountSummary } from "@/types/finance";
import { cn } from "@/lib/utils";

interface SortableAccountCardProps {
  summary: AccountSummary;
  onMovimentar: (accountId: string) => void;
  onViewHistory: (accountId: string) => void;
  onEdit?: (accountId: string) => void;
  onImport?: (accountId: string) => void;
  isDraggingParent: boolean;
  longPressActive: boolean;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
}

export function SortableAccountCard({
  summary,
  onMovimentar,
  onViewHistory,
  onEdit,
  onImport,
  isDraggingParent,
  longPressActive,
  onLongPressStart,
  onLongPressEnd,
}: SortableAccountCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: summary.accountId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.9 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    boxShadow: isDragging ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
    touchAction: 'pan-y' as const, 
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("shrink-0 transition-transform duration-300 ease-out", isDragging && "scale-[1.05]")}
      {...attributes}
      {...(longPressActive ? listeners : {})}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
    >
      <AccountCard
        summary={summary}
        onMovimentar={onMovimentar}
        onViewHistory={onViewHistory}
        onEdit={onEdit}
        onImport={onImport}
      />
    </div>
  );
}