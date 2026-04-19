/**
 * 프로필(Profile) 도메인 제약 조건 상수
 *
 * 목적:
 * - 프로필 관련 validation 기준을 중앙에서 관리
 * - Zod schema / 서버 validation / 테스트 간 일관성 유지
 *
 * 포함 대상:
 * - nickname, avatar 등 profile 도메인 필드
 *
 * ⚠️ 주의사항:
 * - 값 변경 시 DB 스키마, validation, 테스트 모두 영향 받음
 * - auth 도메인(password 등)과 혼합되지 않도록 분리 유지
 */

/**
 * 닉네임 최소 길이
 *
 * - 빈 문자열 방지
 */
export const NICKNAME_MIN_LENGTH = 1;

/**
 * 닉네임 최대 길이
 *
 * - UI/DB 제한 고려
 */
export const NICKNAME_MAX_LENGTH = 10;
