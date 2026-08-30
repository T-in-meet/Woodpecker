"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNoteChatConversationRoute } from "@/lib/constants/routes";

import { useCreateNoteChatConversationMutation } from "../hooks/use-create-note-chat-conversation-mutation";
import {
  type CreateNoteChatConversationInput,
  createNoteChatConversationInputSchema,
} from "../schema";

/**
 * 새로운 노트 챗봇 Conversation을 생성하는 Dialog입니다.
 */
export function NoteChatCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const createMutation = useCreateNoteChatConversationMutation();

  const form = useForm<CreateNoteChatConversationInput>({
    resolver: zodResolver(createNoteChatConversationInputSchema),
    defaultValues: {
      title: "",
    },
  });

  const titleError = form.formState.errors.title?.message;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const conversation = await createMutation.mutateAsync(values.title);

      setOpen(false);
      form.reset();

      router.push(getNoteChatConversationRoute(conversation.id));
    } catch {
      /*
       * Mutation 오류는 아래 사용자 표시 영역에서 처리합니다.
       */
    }
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset();
      createMutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus className="size-4" />새 대화
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 대화</DialogTitle>
          <DialogDescription>
            새로운 노트 챗봇 대화의 제목을 입력하세요.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="note-chat-conversation-title">대화 제목</Label>

            <Input
              id="note-chat-conversation-title"
              autoFocus
              aria-invalid={titleError ? true : undefined}
              placeholder="예: React 공부 정리"
              {...form.register("title")}
            />

            {titleError ? (
              <p className="text-sm text-destructive">{titleError}</p>
            ) : null}

            {createMutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {createMutation.error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>

            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                form.watch("title").trim().length === 0
              }
            >
              {createMutation.isPending ? "생성 중..." : "대화 만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
