"use client";

import { OxQuestionCard } from "@/features/quiz/components/OxQuestionCard";
import type { OxQuestion } from "@/features/quiz/schema";

const previewQuestion: OxQuestion = {
  type: "ox",
  question: "기회비용에는 그 선택 때문에 포기한 대안의 가치가 포함된다.",
  answer: true,
  explanation:
    "기회비용은 실제로 치른 명시적 비용에, 포기한 대안에서 얻을 수 있었던 가치까지 더해 따진다.",
};

/**
 * 랜딩의 퀴즈 미리보기. 목업을 따로 그리지 않고 실제 문항 카드를 그대로 쓴다.
 *
 * `OxQuestionCard`는 데이터 조회나 서버 액션 없이 props만 받으므로 랜딩에
 * 올려도 안전하다. 다만 `onSubmit`이 함수라 서버 컴포넌트에서는 넘길 수 없어
 * 이 파일만 클라이언트 컴포넌트로 둔다.
 *
 * 채점이 끝난 상태로 고정해 선택지가 disabled가 되게 한다 — 방문자가 누를 수
 * 있는 가짜 컨트롤을 만들지 않기 위해서다.
 */
export function QuizPreview() {
  return (
    <OxQuestionCard
      question={previewQuestion}
      onSubmit={() => {}}
      submitted
      userAnswer="true"
      isCorrect
    />
  );
}
