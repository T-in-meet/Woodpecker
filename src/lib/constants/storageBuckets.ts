/**
 * Supabase Storage 버킷 이름 상수
 *
 * 목적:
 * - 문자열 하드코딩 방지
 * - 버킷 이름 변경 시 중앙 관리
 *
 * 사용 예:
 * - 프로필 이미지 업로드 시 avatars 버킷 사용
 */
export const STORAGE_BUCKETS = {
  /**
   * 사용자 프로필 이미지 저장 버킷
   */
  AVATARS: "avatars",
} as const;
