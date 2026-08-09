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
 *
 * 질문 수정 요청을 시작하면 Dialog를 즉시 닫고,
 * 이후 답변 생성 상태와 오류는 Conversation 화면에서 처리합니다.
 *
 * @param props 질문 수정 Dialog 속성
 * @param props.message 현재 수정할 사용자 메시지
 * @param props.onClose Dialog 닫기 함수
 * @param props.onUpdateQuestion 사용자 질문 수정 및 답변 재생성 함수
 * @returns 사용자 질문 수정 Dialog
 */
export function NoteChatQuestionEditDialog({
  message,
  onClose,
  onUpdateQuestion,
}: NoteChatQuestionEditDialogProps) {
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (!message) {
      setQuestion("");
      return;
    }

    setQuestion(message.text);
  }, [message]);

  /**
   * 수정된 질문으로 기존 사용자 메시지를 갱신하고 답변 재생성을 시작합니다.
   *
   * 실행 상태와 오류는 Conversation 화면에서 표시하므로
   * 요청 시작 전에 Dialog를 닫습니다.
   */
  const handleUpdate = async () => {
    if (!message) {
      return;
    }

    const nextQuestion = question.trim();

    if (!nextQuestion || nextQuestion === message.text.trim()) {
      return;
    }

    // Dialog가 닫히면 message가 null이 되므로 실행 전에 수정 대상을 보관합니다.
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

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
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

        <Textarea
          value={question}
          rows={5}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>

          <Button
            type="button"
            disabled={
              question.trim().length === 0 ||
              question.trim() === message?.text.trim()
            }
            onClick={() => {
              void handleUpdate();
            }}
          >
            수정하고 다시 답변받기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
