"use client";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

import type { AddRelatedNoteDialogProps } from "./AddRelatedNoteDialog";

// 대화상자는 폼·검증 라이브러리(zod 포함)를 함께 불러오므로 노트 상세의 초기 번들에서 분리한다.
// 불러오는 동안에는 같은 모양의 비활성 버튼을 그려 레이아웃이 흔들리지 않게 한다.
export const LazyAddRelatedNoteDialog = dynamic<AddRelatedNoteDialogProps>(
  () =>
    import("./AddRelatedNoteDialog").then(
      (module) => module.AddRelatedNoteDialog,
    ),
  {
    ssr: false,
    loading: () => (
      <Button type="button" size="sm" variant="outline" disabled>
        관련 노트 추가
      </Button>
    ),
  },
);
