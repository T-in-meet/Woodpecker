"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type EditingMessage = {
  id: string;
  sequenceNumber: number;
  text: string;
};

type NoteChatQuestionEditDialogProps = {
  message: EditingMessage | null;

  onClose: () => void;

  onUpdateQuestion: (params: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => Promise<void>;
};

/**
 * 기존 사용자 질문을 수정하고 이후 대화를 다시 생성하는 Dialog입니다.
 */
export function NoteChatQuestionEditDialog({
  message,
  onClose,
  onUpdateQuestion,
}: NoteChatQuestionEditDialogProps) {
  const [question, setQuestion] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      setQuestion("");
      setUpdateError(null);
      return;
    }

    setQuestion(message.text);
    setUpdateError(null);
  }, [message]);

  const handleUpdate = async () => {
    if (!message) {
      return;
    }

    const nextQuestion = question.trim();

    if (!nextQuestion || nextQuestion === message.text.trim()) {
      return;
    }

    const targetMessage = message;

    onClose();

    try {
      await onUpdateQuestion({
        messageId: targetMessage.id,
        question: nextQuestion,
        sequenceNumber: targetMessage.sequenceNumber,
      });
    } catch {
      // 수정 실행 오류는 Conversation 화면의 스트림 오류로 표시합니다.
    }
  };

  const handleClose = () => {
    if (isUpdating) {
      return;
    }

    onClose();
  };

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>질문 수정</DialogTitle>

          <DialogDescription>
            이 질문을 수정하면 이후 대화는 삭제되고 수정된 질문으로 새로운
            답변을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={question}
            disabled={isUpdating}
            rows={5}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
          />

          {updateError ? (
            <p role="alert" className="text-sm text-destructive">
              {updateError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={handleClose}
          >
            취소
          </Button>

          <Button
            type="button"
            disabled={
              isUpdating ||
              question.trim().length === 0 ||
              question.trim() === message?.text.trim()
            }
            onClick={() => {
              void handleUpdate();
            }}
          >
            {isUpdating ? "수정 중..." : "수정하고 다시 답변받기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
