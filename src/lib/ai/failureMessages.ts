/**
 * 도메인과 무관하게 항상 같아야 하는 AI 실패 문구.
 *
 * 지연·혼잡·한도 소진은 AI 서버 자체의 상태라 퀴즈든 채점이든 사용자에게 할 말이
 * 같다. `tooLarge`(어떤 입력이 컸는지)와 `unknown`(무슨 동작이 실패했는지)은
 * 도메인마다 알려야 할 내용이 달라 여기 두지 않는다 — 각 도메인의
 * `*_AI_FAILURE_MESSAGES`가 이 값을 펼친 뒤 그 둘을 직접 채운다.
 */
export const SHARED_AI_FAILURE_MESSAGES = {
  delayed: "AI 응답이 지연됐어요. 다시 시도해주세요.",
  quotaExhausted:
    "서비스의 오늘 AI 사용량이 모두 소진됐어요. 잠시 후 다시 시도해주세요.",
  busy: "AI 서버가 혼잡해요. 잠시 후 다시 시도해주세요.",
} as const;
