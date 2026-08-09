"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants/routes";

import { useDeleteNoteChatConversationMutation } from "../hooks/use-delete-note-chat-conversation-mutation";
import { useUpdateNoteChatConversationTitleMutation } from "../hooks/use-update-note-chat-conversation-title-mutation";

type NoteChatConversationMenuProps = {
  conversationId: string;
  title: string;
};

/**
 * 노트 챗봇 Conversation 제목 수정과 삭제 기능을 제공합니다.
 */
export function NoteChatConversationMenu({
  conversationId,
  title,
}: NoteChatConversationMenuProps) {
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);

  const updateMutation = useUpdateNoteChatConversationTitleMutation();
  const deleteMutation = useDeleteNoteChatConversationMutation();

  const handleUpdate = async () => {
    const trimmedTitle = nextTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        conversationId,
        title: trimmedTitle,
      });

      setEditOpen(false);
    } catch {
      // Mutation 오류는 Dialog 내부에서 표시합니다.
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(conversationId);

      setDeleteOpen(false);
      router.push(ROUTES.NOTE_CHATS);
    } catch {
      // Mutation 오류는 AlertDialog 내부에서 표시합니다.
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="대화 메뉴"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setNextTitle(title);
              updateMutation.reset();
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            제목 수정
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              deleteMutation.reset();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            대화 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대화 제목 수정</DialogTitle>
            <DialogDescription>
              대화 목록에 표시할 제목을 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="note-chat-conversation-edit-title">대화 제목</Label>

            <Input
              id="note-chat-conversation-edit-title"
              value={nextTitle}
              onChange={(event) => setNextTitle(event.target.value)}
            />

            {updateMutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {updateMutation.error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => setEditOpen(false)}
            >
              취소
            </Button>

            <Button
              type="button"
              disabled={
                updateMutation.isPending ||
                nextTitle.trim().length === 0 ||
                nextTitle.trim() === title
              }
              onClick={handleUpdate}
            >
              {updateMutation.isPending ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 대화와 연결된 메시지가 함께 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteMutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteMutation.error.message}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
