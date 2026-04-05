const REASON_MESSAGES: Record<string, string> = {
  REQUIRED: "필수 입력 항목입니다",
  INVALID_FORMAT: "올바른 형식을 입력해주세요",
  TOO_SHORT: "입력 내용이 너무 짧습니다",
  TOO_LONG: "입력 내용이 너무 깁니다",
  NOT_AGREED: "동의가 필요합니다",
  INVALID: "올바르지 않은 입력입니다",
  DUPLICATE: "이미 사용 중인 값입니다",
};

export function mapReasonToMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "올바르지 않은 입력입니다";
}
