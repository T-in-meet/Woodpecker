/**
 * 관리자 답변 이미지로 허용하는 MIME 타입 목록입니다.
 *
 * Supabase Storage의 feedback_replies 버킷에 설정된
 * allowed_mime_types와 동일하게 유지해야 합니다.
 */
export const FEEDBACK_REPLY_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/**
 * 관리자 답변 이미지 한 파일의 최대 크기입니다.
 *
 * Supabase Storage의 feedback_replies 버킷에 설정된
 * file_size_limit과 동일한 5MB입니다.
 */
export const FEEDBACK_REPLY_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 관리자 답변 하나에 첨부할 수 있는 최대 이미지 개수입니다. */
export const FEEDBACK_REPLY_MAX_IMAGE_COUNT = 5;
