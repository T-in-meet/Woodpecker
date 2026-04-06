/**
 * 사용자(User) 도메인 제약 조건 상수
 *
 * 목적:
 * - validation 기준을 중앙에서 관리
 * - Zod schema / 서버 validation / 테스트 간 일관성 유지
 *
 * ⚠️ 주의사항:
 * - 값 변경 시 관련된 validation, 테스트 모두 영향 받음
 */

/**
 * 비밀번호 최소 길이
 *
 * - 보안 기준 최소 8자
 */
export const PASSWORD_MIN_LENGTH = 8;
