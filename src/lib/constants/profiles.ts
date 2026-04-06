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

/**
 * 허용되는 아바타 MIME 타입
 *
 * - 서버/클라이언트 업로드 validation 기준
 * - 보안 목적: 실행 파일, 스크립트 업로드 방지
 * - 브라우저 File.type 기준으로 검증
 */
export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * 허용되는 아바타 파일 확장자
 *
 * - 파일명 기반 1차 검증
 * - MIME 타입 검증과 함께 사용해야 우회 방지 가능
 * - 예: .jpg, .png, .webp
 */
export const ALLOWED_AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/**
 * 아바타 최대 파일 크기 (bytes)
 *
 * - 현재: 10MB 제한
 * - 과도한 트래픽 및 저장소 비용 방지
 * - UX 측면에서 업로드 실패 방지용 사전 제한
 *
 * ⚠️ 변경 시 영향:
 * - 업로드 validation
 * - API 제한
 * - 클라이언트 업로드 UX
 */
export const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;
