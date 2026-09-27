"use client";

import { type ComponentType, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { AddRelatedNoteDialogProps } from "./AddRelatedNoteDialog";

type DialogLoadState =
  | { status: "idle" | "loading" | "error" }
  | {
      status: "ready";
      Component: ComponentType<AddRelatedNoteDialogProps>;
    };

// 버튼은 즉시 표시하되 폼·검증 코드는 사용자가 열 때만 다운로드한다.
// Dialog와 Trigger는 유지해 로딩 중 닫기와 닫은 뒤 초점 복귀를 보장한다.
export function LazyAddRelatedNoteDialog({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogLoadState>({ status: "idle" });

  async function loadDialog() {
    setDialog({ status: "loading" });
    try {
      const { AddRelatedNoteDialog } = await import("./AddRelatedNoteDialog");
      setDialog({ status: "ready", Component: AddRelatedNoteDialog });
    } catch {
      setDialog({ status: "error" });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && (dialog.status === "idle" || dialog.status === "error")) {
      void loadDialog();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
        >
          관련 노트 추가
        </Button>
      </DialogTrigger>
      {open &&
        (dialog.status === "ready" ? (
          <dialog.Component noteId={noteId} onClose={() => setOpen(false)} />
        ) : (
          <DialogContent aria-busy={dialog.status === "loading"}>
            <DialogHeader>
              <DialogTitle>관련 노트 추가</DialogTitle>
              <DialogDescription>
                연결할 노트를 선택하는 화면을 준비합니다.
              </DialogDescription>
            </DialogHeader>
            {dialog.status === "error" ? (
              <div className="space-y-4">
                <p role="alert" className="text-sm text-destructive">
                  화면을 불러오지 못했습니다. 다시 시도해주세요.
                </p>
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => void loadDialog()}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                불러오는 중…
              </p>
            )}
          </DialogContent>
        ))}
    </Dialog>
  );
}
