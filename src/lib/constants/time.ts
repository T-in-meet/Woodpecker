export const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * KST(UTC+9) 오프셋. 한국은 서머타임을 쓰지 않아 연중 고정값이다.
 * 복습 일정은 KST 달력일을 기준으로 계산하므로 도메인 간에 같은 값을 공유한다.
 */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
