import { z } from "zod";

/**
 * DB의 review_gradings_user_answer_length_check와 같은 값이다.
 * 바꿀 때 마이그레이션도 함께 올린다.
 * 답안은 노트 본문과 함께 채점 프롬프트에 그대로 들어가므로 이 값이 곧 호출당 비용 상한이다.
 */
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
  /**
   * 비교 화면에 보여준 원본의 본문 해시(`hashNoteContent`). 채점 직전에 다시 읽은
   * 본문의 해시와 대조해 "화면에서 본 원본"과 "AI가 채점한 원본"이 어긋나는 걸 막는다.
   */
  originalContentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "원본 정보가 올바르지 않습니다"),
  answer: z
    .string()
    .max(ANSWER_MAX_LENGTH, "답안이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "답안을 입력해주세요"),
});

/**
 * 피드백 항목(missedConcepts·incorrectPoints)의 개수 상한.
 * 프롬프트 문구와 생성 스키마가 같은 값을 봐야 "요청한 개수"와 "강제하는 개수"가 갈리지 않는다.
 */
export const FEEDBACK_ITEMS_MAX = 5;

// Gemini 채점 응답 및 review_gradings.feedback(jsonb) 공용 스키마
export const gradingFeedbackSchema = z.object({
  summary: z.string(),
  missedConcepts: z.array(z.string()),
  incorrectPoints: z.array(z.string()),
});

/**
 * Gemini 응답 "수신" 스키마. 항목 개수는 일부러 제한하지 않는다.
 *
 * 개수 초과를 여기서 거부하면 채점 전체가 버려진다. 그 비용이 크다 —
 * `review_grading_generations` 행은 Gemini 호출 전 선점 시점에 INSERT되고 되돌리는 함수가
 * 없어서(20260808000000_create_review_gradings.sql) 하루 한도 1회가 영구 소모되고,
 * 선점이 만료될 때까지 60초간 재시도가 막히며, 이미 나간 Gemini 비용은 재시도 때 다시 든다.
 * 6번째 항목 하나 때문에 치를 값이 아니다. 초과분은 아래 `normalizeGradingResponse`가 잘라낸다.
 *
 * 타입 검증은 그대로다. 배열에 숫자·객체가 섞인 malformed 응답은 여기서 거부된다.
 */
export const gradingResponseSchema = gradingFeedbackSchema.extend({
  score: z.number().int().min(0).max(100),
});

/**
 * Gemini `responseJsonSchema`에만 쓰는 "생성" 스키마.
 * `.max()`가 JSON Schema의 `maxItems`로 변환돼 디코딩 단계에서 개수를 강제한다.
 * 이게 1차 계약이고, 위 수신 스키마와 정규화는 이 계약이 깨졌을 때의 방어선이다.
 */
export const gradingGenerationSchema = gradingResponseSchema.extend({
  missedConcepts: z.array(z.string()).max(FEEDBACK_ITEMS_MAX),
  incorrectPoints: z.array(z.string()).max(FEEDBACK_ITEMS_MAX),
});

/**
 * 검증을 통과한 채점 응답의 항목 수를 상한에 맞춘다.
 *
 * 반드시 `gradingResponseSchema` 파싱 "뒤에" 부른다. `unknown`을 먼저 자르면
 * 배열인지, 원소가 문자열인지 확인하지 않은 값을 그대로 저장하게 된다.
 */
export function normalizeGradingResponse(
  response: GradingResponse,
): GradingResponse {
  return {
    ...response,
    missedConcepts: response.missedConcepts.slice(0, FEEDBACK_ITEMS_MAX),
    incorrectPoints: response.incorrectPoints.slice(0, FEEDBACK_ITEMS_MAX),
  };
}

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;
export type GradingFeedback = z.infer<typeof gradingFeedbackSchema>;
export type GradingResponse = z.infer<typeof gradingResponseSchema>;
