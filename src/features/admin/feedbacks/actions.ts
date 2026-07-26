"use server";

import { createUserNotification } from "@/features/notifications/create-user-notification";
import {
  buildFeedbackReplyNotificationDefinition,
  USER_NOTIFICATION_DEFINITIONS,
} from "@/features/notifications/definitions";
import { NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import { feedbackReplyFormSchema } from "./schema";
import {
  createFeedbackReplyImagePath,
  validateFeedbackReplyImageFiles,
  validateFeedbackReplyImageFileSignatures,
} from "./utils/feedback-reply-image";

export type SaveFeedbackReplyResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type DeleteFeedbackReplyResult =
  | { ok: true }
  | { ok: false; message: string };

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
  const adminUserId = await requireAdmin();
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
    .filter((value): value is File => value instanceof File);

  const imageValidationError = validateFeedbackReplyImageFiles(
    existingImagePaths.length,
    imageFiles,
  );

  if (imageValidationError) {
    return { ok: false, message: imageValidationError };
  }

  const imageSignatureValidationError =
    await validateFeedbackReplyImageFileSignatures(imageFiles);

  if (imageSignatureValidationError) {
    return { ok: false, message: imageSignatureValidationError };
  }

  const supabase = createAdminClient();
  const { data: feedback, error: feedbackError } = await supabase
    .from("feedbacks")
    .select("id, title, user_id")
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
    const isFirstReply = !existingReply;

    for (const file of imageFiles) {
      const path = createFeedbackReplyImagePath(feedbackId, file);
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

    if (isFirstReply) {
      const notificationDefinition = buildFeedbackReplyNotificationDefinition({
        feedbackId,
      });

      try {
        await createUserNotification({
          actorUserId: adminUserId,
          body: `"${feedback.title}" 피드백에 관리자 답변이 등록되었습니다.`,
          clickPath: notificationDefinition.clickPath,
          metadata: {
            feedbackId,
          },
          operation: "feedback_reply_notification",
          pushEnabled:
            USER_NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.FEEDBACK_REPLY]
              .pushEnabled,
          title: "피드백 답변이 등록되었습니다.",
          type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
          userId: feedback.user_id,
        });
      } catch (notificationError) {
        console.error(
          "[saveFeedbackReply] notification failed:",
          notificationError,
        );
      }
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
 * 관리자 답변을 삭제하고 연결된 답변 이미지를 Storage에서 제거합니다.
 *
 * 답변이 삭제되면 해당 피드백은 다시 미해결 상태로 간주하므로
 * feedbacks.status를 OPEN으로 되돌립니다.
 *
 * @param feedbackId 답변을 삭제할 feedbacks.id
 * @returns 삭제 성공 여부와 사용자 표시용 오류 메시지
 */
export async function deleteFeedbackReply(
  feedbackId: string,
): Promise<DeleteFeedbackReplyResult> {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: reply, error: replyLoadError } = await supabase
    .from("feedback_replies")
    .select("id, image_paths")
    .eq("feedback_id", feedbackId)
    .maybeSingle();

  if (replyLoadError) {
    return { ok: false, message: "답변 정보를 불러오지 못했습니다." };
  }

  if (!reply) {
    return { ok: false, message: "삭제할 답변이 없습니다." };
  }

  const { error: deleteError } = await supabase
    .from("feedback_replies")
    .delete()
    .eq("id", reply.id);

  if (deleteError) {
    return { ok: false, message: "답변 삭제에 실패했습니다." };
  }

  const { error: statusError } = await supabase
    .from("feedbacks")
    .update({ status: "OPEN" })
    .eq("id", feedbackId);

  if (statusError) {
    return { ok: false, message: "피드백 상태 변경에 실패했습니다." };
  }

  // DB 삭제가 끝난 뒤 Storage object를 정리한다. 실패해도 row 삭제를 되돌리지는 않는다.
  if (reply.image_paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from("feedback_replies")
      .remove(reply.image_paths);

    if (removeError) {
      console.error(
        "[deleteFeedbackReply] storage remove failed:",
        removeError,
      );
    }
  }

  return { ok: true };
}
