"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { useNoteChatDialogVisualViewport } from "../hooks/use-note-chat-dialog-visual-viewport";
import { useUpdateNoteChatConversationTitleMutation } from "../hooks/use-update-note-chat-conversation-title-mutation";
import {
  type UpdateNoteChatConversationTitleInput,
  updateNoteChatConversationTitleInputSchema,
} from "../schema";

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

  const updateMutation = useUpdateNoteChatConversationTitleMutation();
  const deleteMutation = useDeleteNoteChatConversationMutation();
  const dialogViewportStyle = useNoteChatDialogVisualViewport(editOpen);

  const form = useForm<UpdateNoteChatConversationTitleInput>({
    resolver: zodResolver(updateNoteChatConversationTitleInputSchema),
    defaultValues: {
      conversationId,
      title,
    },
  });

  const nextTitle = form.watch("title");
  const titleError = form.formState.errors.title?.message;

  const handleUpdate = form.handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync(values);

      setEditOpen(false);
    } catch {
      // Mutation 오류는 Dialog 내부에서 표시합니다.
    }
  });

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
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">대화 메뉴</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              form.reset({
                conversationId,
                title,
              });
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
        <DialogContent
          className="pointer-coarse:overflow-y-auto"
          style={
            dialogViewportStyle
              ? {
                  top: dialogViewportStyle.top,
                  maxHeight: dialogViewportStyle.maxHeight,
                }
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>대화 제목 수정</DialogTitle>
            <DialogDescription>
              대화 목록에 표시할 제목을 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-2">
              <Label htmlFor="note-chat-conversation-edit-title">
                대화 제목
              </Label>

              <Input
                id="note-chat-conversation-edit-title"
                enterKeyHint="done"
                aria-invalid={titleError ? true : undefined}
                {...form.register("title")}
              />

              {titleError ? (
                <p className="text-sm text-destructive">{titleError}</p>
              ) : null}

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
                type="submit"
                disabled={
                  updateMutation.isPending ||
                  nextTitle.trim().length === 0 ||
                  nextTitle.trim() === title
                }
              >
                {updateMutation.isPending ? "수정 중..." : "수정"}
              </Button>
            </DialogFooter>
          </form>
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

          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>

            <AlertDialogCancel autoFocus disabled={deleteMutation.isPending}>
              취소
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
