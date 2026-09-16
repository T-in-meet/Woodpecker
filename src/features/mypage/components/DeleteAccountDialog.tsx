"use client";

import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            모든 데이터가 영구적으로 삭제되며 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-left">
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || !isConfirmed}
            onClick={(event) => {
              // 삭제 성공 시 Server Action의 redirect로 페이지가 바뀌므로
              // 요청 결과와 무관하게 자동으로 닫히지 않게 한다.
              event.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "삭제 중..." : "계정 삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
