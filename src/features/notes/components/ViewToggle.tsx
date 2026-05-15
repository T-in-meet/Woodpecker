import { AlignJustify, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import type { NotesView } from "../utils/buildNotesUrl";

type ViewToggleProps = {
  view: NotesView;
  onChange: (v: NotesView) => void;
};

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="grid grid-cols-2 divide-x divide-input rounded-md border border-input">
      <ViewButton
        active={view === "list"}
        onClick={() => onChange("list")}
        aria-label="리스트 보기"
      >
        <AlignJustify className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </ViewButton>
      <ViewButton
        active={view === "cards"}
        onClick={() => onChange("cards")}
        aria-label="카드 보기"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Cards</span>
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
  "aria-label": ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
