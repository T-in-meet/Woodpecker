import { z } from "zod";

/**
 * claim_quiz_generation_v2·claim_review_grading이 공통으로 돌려주는 jsonb 형태.
 * 상태값의 의미는 도메인마다 다르므로 여기서는 형태만 강제하고, 상태별 처리는
 * 각 도메인의 CLAIM_ERROR_MESSAGES가 맡는다.
 */
export const claimResultSchema = z.object({
  status: z.string(),
  claimToken: z.string().uuid().optional(),
});
