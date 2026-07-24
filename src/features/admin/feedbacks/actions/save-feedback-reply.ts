"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  FEEDBACK_REPLY_ALLOWED_TYPES,
  FEEDBACK_REPLY_MAX_IMAGE_COUNT,
  FEEDBACK_REPLY_MAX_IMAGE_SIZE,
  feedbackReplyFormSchema,
} from "../schemas/feedback-reply-schema";

export type SaveFeedbackReplyResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * 관리자 답변을 생성하거나 수정하고 피드백 상태를 해결 완료로 변경합니다.
 *
 * feedback_replies는 feedback_id unique 제약을 가지므로 upsert로 단일 답변을 유지합니다.
 * 새 이미지 업로드가 중간에 실패하면 방금 업로드한 object를 제거해 DB와 Storage 불일치를 줄입니다.
 *
 * @param feedbackId 답변을 연결할 feedbacks.id
 * @param formData 답변 제목/내용, 유지할 기존 이미지 path, 새 이미지 파일 목록
 * @returns 저장 성공 여부와 사용자에게 표시할 오류 정보
 */
export async function saveFeedbackReply(
  feedbackId: string,
  formData: FormData,
): Promise<SaveFeedbackReplyResult> {
  const adminUserId = await assertAdmin();
  const parsed = feedbackReplyFormSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingImagePaths = formData
    .getAll("existingImagePaths")
    .filter((value): value is string => typeof value === "string");
  const imageFiles = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const imageValidationError = validateImageFiles(
    existingImagePaths.length,
    imageFiles,
  );

  if (imageValidationError) {
    return { ok: false, message: imageValidationError };
  }

  const supabase = createAdminClient();
  const { data: feedback, error: feedbackError } = await supabase
    .from("feedbacks")
    .select("id")
    .eq("id", feedbackId)
    .single();

  if (feedbackError || !feedback) {
    return { ok: false, message: "피드백을 찾을 수 없습니다." };
  }

  const uploadedPaths: string[] = [];

  try {
    // 수정 저장 시 제거된 기존 이미지 object를 정리하기 위해 현재 path를 먼저 확보한다.
    const { data: existingReply, error: existingReplyError } = await supabase
      .from("feedback_replies")
      .select("image_paths")
      .eq("feedback_id", feedbackId)
      .maybeSingle();

    if (existingReplyError) {
      throw new Error(existingReplyError.message);
    }

    const previousImagePaths = existingReply?.image_paths ?? [];

    for (const file of imageFiles) {
      const path = createReplyImagePath(feedbackId, file);
      const { error } = await supabase.storage
        .from("feedback_replies")
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      uploadedPaths.push(path);
    }

    const imagePaths = [...existingImagePaths, ...uploadedPaths];

    // 답변 row 저장과 feedback 상태 변경은 같은 관리자 작업의 결과로 함께 처리한다.
    const { error: replyError } = await supabase
      .from("feedback_replies")
      .upsert(
        {
          feedback_id: feedbackId,
          title: parsed.data.title,
          content: parsed.data.content,
          image_paths: imagePaths,
          created_by: adminUserId,
        },
        { onConflict: "feedback_id" },
      );

    if (replyError) {
      throw new Error(replyError.message);
    }

    const { error: statusError } = await supabase
      .from("feedbacks")
      .update({ status: "RESOLVED" })
      .eq("id", feedbackId);

    if (statusError) {
      throw new Error(statusError.message);
    }

    const removedImagePaths = previousImagePaths.filter(
      (path) => !imagePaths.includes(path),
    );

    // DB 저장은 성공한 상태이므로, 제거 실패는 사용자 저장 실패로 되돌리지 않는다.
    if (removedImagePaths.length > 0) {
      await supabase.storage.from("feedback_replies").remove(removedImagePaths);
    }

    return { ok: true };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("feedback_replies").remove(uploadedPaths);
    }

    console.error("[saveFeedbackReply] failed:", error);
    return { ok: false, message: "답변 저장에 실패했습니다." };
  }
}

/**
 * 현재 세션 사용자가 관리자 답변을 저장할 수 있는지 확인합니다.
 *
 * @returns 답변 created_by에 저장할 관리자 사용자 ID
 */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return user.id;
}

/**
 * 새로 첨부된 답변 이미지 파일의 개수, MIME, 크기 제약을 검증합니다.
 *
 * @param existingCount 유지할 기존 이미지 개수
 * @param files 새로 업로드할 이미지 파일 목록
 * @returns 유효하면 null, 그렇지 않으면 사용자 표시용 오류 문구
 */
function validateImageFiles(existingCount: number, files: File[]) {
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
function createReplyImagePath(feedbackId: string, file: File) {
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
