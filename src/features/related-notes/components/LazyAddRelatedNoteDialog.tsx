"use client";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

import type { AddRelatedNoteDialogProps } from "./AddRelatedNoteDialog";

function DisabledAddRelatedNoteButton() {
  return (
    <Button type="button" size="sm" variant="outline" disabled>
      관련 노트 추가
    </Button>
  );
}

// 대화상자가 쓰는 zod·@hookform/resolvers를 노트 상세의 초기 번들에서 분리한다.
// react-hook-form은 UpdateRelatedNoteReasonDialog가 정적으로 불러오므로 초기 번들에 남는다.
// 불러오는 동안에는 같은 모양의 비활성 버튼을 그려 레이아웃이 흔들리지 않게 하고,
// 청크 로드에 실패해도 에러가 라우트 error boundary로 번져 노트 상세 전체를 가리지 않도록 같은 버튼으로 대체한다.
export const LazyAddRelatedNoteDialog = dynamic<AddRelatedNoteDialogProps>(
  () =>
    import("./AddRelatedNoteDialog")
      .then((module) => module.AddRelatedNoteDialog)
      .catch(() => DisabledAddRelatedNoteButton),
  {
    ssr: false,
    loading: DisabledAddRelatedNoteButton,
  },
);
