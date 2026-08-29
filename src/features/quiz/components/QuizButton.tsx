"use client";

import { BrainIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

const importQuizModal = () => import("./QuizModal");

/**
 * 퀴즈 모달은 문항 카드 3종과 생성 로직을 함께 끌고 온다. 노트 상세 진입만으로는
 * 필요 없는 코드라 초기 청크에서 빼고, 버튼에 hover·focus가 닿을 때 미리 받아 둔다.
 */
const QuizModal = dynamic(() => importQuizModal().then((m) => m.QuizModal), {
  ssr: false,
});

type QuizButtonProps = {
  noteId: string;
  noteTitle: string;
};

export function QuizButton({ noteId, noteTitle }: QuizButtonProps) {
  const [open, setOpen] = useState(false);
  // dynamic()은 렌더되는 순간 청크를 받으므로, 한 번이라도 열기 전까지는 렌더하지 않는다.
  // 닫은 뒤에도 계속 마운트해 둬야 다이얼로그 닫힘 애니메이션이 끊기지 않는다.
  const [hasOpened, setHasOpened] = useState(false);

  const preloadQuizModal = useCallback(() => {
    void importQuizModal();
  }, []);

  const handleClick = useCallback(() => {
    setHasOpened(true);
    setOpen(true);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={handleClick}
        onMouseEnter={preloadQuizModal}
        onFocus={preloadQuizModal}
      >
        <BrainIcon data-icon="inline-start" className="size-4" />
        퀴즈 풀기
      </Button>

      {hasOpened && (
        <QuizModal
          noteId={noteId}
          noteTitle={noteTitle}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
