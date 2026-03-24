"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccountAction } from "../actions";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirmed = confirmInput === userEmail;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmInput("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  function handleDelete() {
    if (!isConfirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction();
      if (result?.error) {
        setError(
          typeof result.error === "string"
            ? result.error
            : "계정 삭제에 실패했습니다",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>계정 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            정말 계정을 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제되며, 이
            작업은 되돌릴 수 없습니다.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-email" className="text-sm">
              확인을 위해 이메일 주소
              <br />
              {userEmail}를 입력해 주세요
            </Label>
            <Input
              id="confirm-email"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={userEmail}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending || !isConfirmed}
            >
              {isPending ? "삭제 중..." : "계정 삭제"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
