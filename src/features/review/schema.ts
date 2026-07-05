import { z } from "zod";

export const ANSWER_MAX_LENGTH = 50000;

export const submitAnswerSchema = z.object({
  noteId: z.string().uuid("유효한 노트 ID가 아닙니다"),
  answer: z
    .string()
    .max(ANSWER_MAX_LENGTH, "답안이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "답안을 입력해주세요"),
});

export const completeReviewSchema = z.object({
  noteId: z.string().uuid("유효한 노트 ID가 아닙니다"),
  reviewLogId: z.string().uuid("유효한 리뷰 로그 ID가 아닙니다"),
});

export const gradeAnswerSchema = z.object({
  noteId: z.string().uuid("유효한 노트 ID가 아닙니다"),
  reviewLogId: z.string().uuid("유효한 리뷰 로그 ID가 아닙니다"),
  answer: z
    .string()
    .max(ANSWER_MAX_LENGTH, "답안이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "답안을 입력해주세요"),
});

// Gemini 채점 응답 및 review_gradings.feedback(jsonb) 공용 스키마
export const gradingFeedbackSchema = z.object({
  summary: z.string(),
  missedConcepts: z.array(z.string()),
  incorrectPoints: z.array(z.string()),
});

export const gradingResponseSchema = gradingFeedbackSchema.extend({
  score: z.number().int().min(0).max(100),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;
export type GradingFeedback = z.infer<typeof gradingFeedbackSchema>;
export type GradingResponse = z.infer<typeof gradingResponseSchema>;
