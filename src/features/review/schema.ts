import { z } from "zod";

export const submitAnswerSchema = z.object({
  noteId: z.string().uuid("유효한 노트 ID가 아닙니다"),
  answer: z
    .string()
    .max(50000, "답안이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "답안을 입력해주세요"),
});

export const completeReviewSchema = z.object({
  noteId: z.string().uuid("유효한 노트 ID가 아닙니다"),
  reviewLogId: z.string().uuid("유효한 리뷰 로그 ID가 아닙니다"),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
