import { z } from "zod";

/**
 * 관리자 피드백 답변 작성 및 수정 폼의 입력값을 검증합니다.
 */
export const feedbackReplyFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "답변 제목을 입력해 주세요.")
    .max(100, "답변 제목은 100자 이하로 입력해 주세요."),
  content: z.string().trim().min(1, "답변 내용을 입력해 주세요."),
});

/** 관리자 피드백 답변 폼에서 사용하는 입력값 타입입니다. */
export type FeedbackReplyFormValues = z.infer<typeof feedbackReplyFormSchema>;
