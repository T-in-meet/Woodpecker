import { z } from "zod";

export const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const profileSchema = z.object({
  nickname: z
    .string()
    .min(1, "닉네임은 1자 이상이어야 합니다")
    .max(10, "닉네임은 10자 이내로 입력해주세요"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "새 비밀번호가 일치하지 않습니다",
    path: ["confirmNewPassword"],
  });

export type ProfileFormInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---- 피드백 (#266) ----

export const FEEDBACK_CATEGORIES = ["BUG", "FEATURE", "ETC"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "오류 신고",
  FEATURE: "개선 제안",
  ETC: "기타 문의",
};

/**
 * 문의가 가리키는 기능 영역. 유형(category)과 직교하는 축이다.
 *
 * category만으로는 "버그 12건"이 에디터 문제인지 알림 문제인지 알 수 없어,
 * 관리자 화면이 두 축을 교차 필터할 수 있도록 분리했다.
 * 값 목록은 feedbacks_area_check 제약과 동일하게 유지할 것.
 */
export const FEEDBACK_AREAS = [
  "NOTE",
  "REVIEW",
  "AI",
  "NOTIFICATION",
  "ACCOUNT",
  "ETC",
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const FEEDBACK_AREA_LABELS: Record<FeedbackArea, string> = {
  NOTE: "노트",
  REVIEW: "복습",
  AI: "AI",
  NOTIFICATION: "알림",
  ACCOUNT: "계정",
  ETC: "기타",
};

export const FEEDBACK_TITLE_MAX_LENGTH = 100;
export const FEEDBACK_CONTENT_MAX_LENGTH = 2000;
export const FEEDBACK_IMAGE_MAX_COUNT = 3;
// feedbacks 버킷의 file_size_limit(5MB)·allowed_mime_types와 동일하게 유지할 것
export const FEEDBACK_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const FEEDBACK_IMAGE_ALLOWED_TYPES = AVATAR_ALLOWED_TYPES;

export const FEEDBACK_DAILY_LIMIT_MESSAGE =
  "문의사항은 하루에 1건만 제출할 수 있습니다. 내일 다시 시도해주세요.";

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, {
    message: "문의 유형을 선택해주세요",
  }),
  area: z.enum(FEEDBACK_AREAS, {
    message: "관련 기능을 선택해주세요",
  }),
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(
      FEEDBACK_TITLE_MAX_LENGTH,
      `제목은 ${FEEDBACK_TITLE_MAX_LENGTH}자 이내로 입력해주세요`,
    ),
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요")
    .max(
      FEEDBACK_CONTENT_MAX_LENGTH,
      `내용은 ${FEEDBACK_CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}자 이내로 입력해주세요`,
    ),
});

export type FeedbackFormInput = z.infer<typeof feedbackSchema>;
