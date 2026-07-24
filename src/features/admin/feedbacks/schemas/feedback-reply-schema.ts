import { z } from "zod";

/**
 * feedback_replies Storage bucket migration의 allowed_mime_types와 동일한 허용 MIME 목록입니다.
 */
export const FEEDBACK_REPLY_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** 답변 이미지 한 파일의 최대 크기입니다. Storage bucket 제한과 동일하게 5MB입니다. */
export const FEEDBACK_REPLY_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 관리자 답변 하나에 첨부할 수 있는 최대 이미지 개수입니다. */
export const FEEDBACK_REPLY_MAX_IMAGE_COUNT = 5;

/**
 * 관리자 답변 작성/수정 form의 클라이언트 검증 schema입니다.
 */
export const feedbackReplyFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "답변 제목을 입력해 주세요.")
    .max(100, "답변 제목은 100자 이하로 입력해 주세요."),
  content: z.string().trim().min(1, "답변 내용을 입력해 주세요."),
});

/**
 * react-hook-form에서 사용하는 관리자 답변 form 값 타입입니다.
 */
export type FeedbackReplyFormValues = z.infer<typeof feedbackReplyFormSchema>;
