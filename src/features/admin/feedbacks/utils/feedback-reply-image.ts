import { createAdminClient } from "@/lib/supabase/admin";

import {
  FEEDBACK_REPLY_ALLOWED_TYPES,
  FEEDBACK_REPLY_MAX_IMAGE_COUNT,
  FEEDBACK_REPLY_MAX_IMAGE_SIZE,
} from "../constants/feedback-reply";
import type { FeedbackSignedImage } from "../types/feedback-detail";

/**
 * 새로 첨부된 답변 이미지 파일의 개수, MIME, 크기 제약을 검증합니다.
 *
 * @param existingCount 유지할 기존 이미지 개수
 * @param files 새로 업로드할 이미지 파일 목록
 * @returns 유효하면 null, 그렇지 않으면 사용자 표시용 오류 문구
 */
export function validateFeedbackReplyImageFiles(
  existingCount: number,
  files: File[],
) {
  if (existingCount + files.length > FEEDBACK_REPLY_MAX_IMAGE_COUNT) {
    return `이미지는 최대 ${FEEDBACK_REPLY_MAX_IMAGE_COUNT}개까지 첨부할 수 있습니다.`;
  }

  for (const file of files) {
    if (
      !(FEEDBACK_REPLY_ALLOWED_TYPES as readonly string[]).includes(file.type)
    ) {
      return "JPG, PNG, GIF, WebP 형식만 업로드할 수 있습니다.";
    }

    if (file.size > FEEDBACK_REPLY_MAX_IMAGE_SIZE) {
      return "이미지 파일은 5MB 이하만 업로드할 수 있습니다.";
    }
  }

  return null;
}

/**
 * feedback_replies bucket의 파일 경로 규칙에 맞는 object path를 생성합니다.
 *
 * @param feedbackId 첫 번째 폴더로 사용할 feedbacks.id
 * @param file 확장자를 결정할 업로드 파일
 * @returns `{feedback_id}/{uuid}.{ext}` 형식의 Storage object path
 */
export function createFeedbackReplyImagePath(feedbackId: string, file: File) {
  const extension = getImageExtension(file);
  const uniqueName =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${feedbackId}/${uniqueName}.${extension}`;
}

/**
 * Storage allowed_mime_types와 일치하는 이미지 확장자를 반환합니다.
 */
function getImageExtension(file: File) {
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };

  return extensionByMime[file.type] ?? "png";
}

/** 피드백 이미지가 저장되는 private Storage bucket입니다. */
type FeedbackImageBucket = "feedbacks" | "feedback_replies";

/**
 * private Storage object path 목록을 signed URL 목록으로 변환합니다.
 *
 * @param bucket 이미지가 저장된 private bucket
 * @param paths bucket 내부 object path 목록
 * @returns 원본 object path와 signed URL 목록
 */
export async function createFeedbackSignedImages(
  bucket: FeedbackImageBucket,
  paths: string[],
): Promise<FeedbackSignedImage[]> {
  const supabase = createAdminClient();

  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

      if (error) {
        throw new Error(`Failed to create signed image URL: ${error.message}`);
      }

      return {
        path,
        signedUrl: data.signedUrl,
      };
    }),
  );
}
