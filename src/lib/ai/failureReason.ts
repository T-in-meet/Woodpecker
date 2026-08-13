import { CloudflareAiError } from "./client";

/**
 * AI 호출 실패를 "사용자에게 설명할 수 있는 이유"로 좁힌다.
 *
 * 문구 자체는 도메인이 정한다(퀴즈와 채점은 말투도 안내도 다르다).
 * 여기서는 Cloudflare의 숫자 코드와 로컬 오류 종류를 해석하는 규칙만 한 곳에 모아,
 * 두 도메인이 같은 판별을 각자 복사하지 않게 한다.
 */
export const AI_FAILURE_REASONS = [
  /** 시간 안에 응답을 못 받았다. 재시도하면 될 수 있다. */
  "delayed",
  /** 계정의 오늘 무료 할당량이 끝났다. 초기화 전까지 재시도해도 실패한다. */
  "quotaExhausted",
  /** 공급자 용량 부족. 잠시 뒤면 풀린다. */
  "busy",
  /** 입력이 모델 한도를 넘었다. 재시도로는 해결되지 않는다. */
  "tooLarge",
  /** 위 어디에도 해당하지 않음. */
  "unknown",
] as const;

export type AiFailureReason = (typeof AI_FAILURE_REASONS)[number];

/**
 * Cloudflare 오류 코드.
 * developers.cloudflare.com/workers-ai/platform/errors
 */
const REASON_BY_CODE: Record<number, AiFailureReason> = {
  3006: "tooLarge", // Request too large (413)
  3007: "delayed", // Timeout
  3008: "delayed", // Aborted
  3036: "quotaExhausted", // 일일 무료 10,000 Neurons 소진 (429)
  3040: "busy", // Out of capacity (429)
};

export function toAiFailureReason(error: unknown): AiFailureReason {
  if (!(error instanceof CloudflareAiError)) {
    return "unknown";
  }

  // 로컬에서 끊긴 경우는 응답 자체를 못 받았으므로 코드가 없다.
  // Cloudflare의 3007·3008과 원인은 달라도 사용자에게 할 말은 같다.
  if (error.kind === "timeout" || error.kind === "aborted") {
    return "delayed";
  }

  if (error.code === undefined) {
    return "unknown";
  }

  return REASON_BY_CODE[error.code] ?? "unknown";
}
