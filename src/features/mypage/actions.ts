"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { FEEDBACK_CATEGORY_LABELS } from "@/features/admin/feedbacks/constants/feedback-labels";
import { createAdminNotification } from "@/features/notifications/create-admin-notification";
import { buildAdminFeedbackCreatedNotificationDefinition } from "@/features/notifications/definitions";
import {
  NOTIFICATION_OPERATIONAL_ERROR_CODES,
  NOTIFICATION_OPERATIONAL_ERROR_FEATURES,
  NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS,
  NOTIFICATION_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import { recordOperationalError } from "@/features/operational-errors/record";
import { getKstDayBoundsUtc } from "@/features/review/lib/kstDay";
import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_SIZE,
  changePasswordSchema,
  FEEDBACK_DAILY_LIMIT_MESSAGE,
  FEEDBACK_IMAGE_ALLOWED_TYPES,
  FEEDBACK_IMAGE_MAX_COUNT,
  FEEDBACK_IMAGE_MAX_SIZE,
  type FeedbackCategory,
  feedbackSchema,
  profileSchema,
} from "./schema";

export async function updateProfileAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = profileSchema.safeParse({
    nickname: formData.get("nickname"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nickname: parsed.data.nickname,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { error: "프로필 업데이트에 실패했습니다" };
  }

  return { data };
}

export async function uploadAvatarAction(
  _prevState: unknown,
  formData: FormData,
) {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "파일을 선택해주세요" };
  }

  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다" };
  }

  if (file.size > AVATAR_MAX_SIZE) {
    return { error: "파일 크기는 5MB 이하여야 합니다" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "인증이 필요합니다" };

  const path = `${user.id}/avatar`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("[uploadAvatarAction] supabase upload failed:", uploadError);
    return { error: "이미지 업로드에 실패했습니다" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      avatar_url: cacheBustedUrl,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: "프로필 업데이트에 실패했습니다" };

  return { data };
}

export async function deleteAvatarAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "인증이 필요합니다" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: "아바타 삭제에 실패했습니다" };

  const { error: removeError } = await supabase.storage
    .from("avatars")
    .remove([`${user.id}/avatar`]);

  if (removeError) {
    console.error("아바타 파일 삭제 실패:", removeError.message);
  }

  return { data };
}

export async function changePasswordAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "인증이 필요합니다" };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return { error: "인증 정보가 올바르지 않습니다" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { error: "비밀번호 변경에 실패했습니다" };
  }

  return { data: { success: true as const } };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ROUTES.LOGIN);
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: "계정 삭제에 실패했습니다" };
  }

  await supabase.auth.signOut();
  redirect(ROUTES.LOGIN);
}

// ---- 피드백 (#266) ----

async function removeFeedbackImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
): Promise<boolean> {
  if (paths.length === 0) return true;

  const { error } = await supabase.storage.from("feedbacks").remove(paths);
  if (error) {
    console.error("[feedback] 이미지 정리 실패:", error.message);
    return false;
  }

  return true;
}

export async function createFeedbackAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = feedbackSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const images = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (images.length > FEEDBACK_IMAGE_MAX_COUNT) {
    return {
      error: `이미지는 최대 ${FEEDBACK_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다`,
    };
  }

  for (const file of images) {
    if (
      !(FEEDBACK_IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)
    ) {
      return { error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다" };
    }
    if (file.size > FEEDBACK_IMAGE_MAX_SIZE) {
      return { error: "이미지 크기는 장당 5MB 이하여야 합니다" };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  // 하루 1개 사전 체크 — 동시 요청 경합은 unique index가 최종적으로 막는다
  const { startUtcIso, endUtcIso } = getKstDayBoundsUtc(new Date());
  const { data: todayRows, error: todayError } = await supabase
    .from("feedbacks")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", startUtcIso)
    .lt("created_at", endUtcIso)
    .limit(1);

  if (todayError) {
    console.error("[createFeedbackAction] 일일 제한 조회 실패:", todayError);
    return { error: "문의사항 제출에 실패했습니다" };
  }

  if (todayRows.length > 0) {
    return { error: FEEDBACK_DAILY_LIMIT_MESSAGE };
  }

  // 스토리지 경로에 feedback id가 필요하므로 insert 전에 미리 생성한다
  const feedbackId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  for (const file of images) {
    const ext = file.type.split("/")[1] ?? "bin";
    const path = `${user.id}/${feedbackId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("feedbacks")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error("[createFeedbackAction] 업로드 실패:", uploadError);
      await removeFeedbackImages(supabase, uploadedPaths);
      return { error: "이미지 업로드에 실패했습니다" };
    }

    uploadedPaths.push(path);
  }

  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      id: feedbackId,
      user_id: user.id,
      note_id: null,
      category: parsed.data.category,
      title: parsed.data.title,
      content: parsed.data.content,
      image_urls: uploadedPaths,
    })
    .select()
    .single();

  if (error) {
    await removeFeedbackImages(supabase, uploadedPaths);

    // 23505: unique_violation — 사전 체크를 통과한 동시 요청이 인덱스에 걸린 경우
    if (error.code === "23505") {
      return { error: FEEDBACK_DAILY_LIMIT_MESSAGE };
    }

    console.error("[createFeedbackAction] insert 실패:", error);
    return { error: "문의사항 제출에 실패했습니다" };
  }

  await notifyAdminsOfNewFeedback({
    category: parsed.data.category,
    feedbackId,
    title: parsed.data.title,
    userId: user.id,
  });

  return { data };
}

type NotifyAdminsOfNewFeedbackInput = {
  category: FeedbackCategory;
  feedbackId: string;
  title: string;
  userId: string;
};

/**
 * 새 피드백 관리자 알림 생성 실패를 운영 오류로 기록합니다.
 *
 * @param error 알림 생성 과정에서 발생한 오류
 * @param feedbackId 알림 대상 feedbacks.id
 * @param userId 피드백을 등록한 사용자 ID
 */
async function recordAdminFeedbackNotificationFailure(
  error: unknown,
  feedbackId: string,
  userId: string,
) {
  await recordOperationalError({
    actorUserId: userId,
    context: { feedbackId },
    error,
    errorCode:
      NOTIFICATION_OPERATIONAL_ERROR_CODES.ADMIN_NOTIFICATION_CREATE_FAILED,
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    message: "새 피드백 관리자 알림 생성에 실패했습니다.",
    operation:
      NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.CREATE_ADMIN_FEEDBACK_NOTIFICATION,
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE,
  });
}

/**
 * 새 피드백이 등록됐음을 모든 관리자에게 알립니다.
 *
 * 알림 실패가 피드백 제출 자체를 실패시키면 안 되므로
 * 반환된 실패는 여기서 추가 기록하거나 호출부로 전파하지 않습니다.
 * 예상하지 못한 예외만 방어적으로 운영 오류에 기록합니다.
 *
 * @param input 알림 본문과 클릭 경로를 구성할 피드백 정보
 */
async function notifyAdminsOfNewFeedback({
  category,
  feedbackId,
  title,
  userId,
}: NotifyAdminsOfNewFeedbackInput) {
  const definition = buildAdminFeedbackCreatedNotificationDefinition({
    feedbackId,
  });

  try {
    await createAdminNotification({
      body: `[${FEEDBACK_CATEGORY_LABELS[category]}] ${title}`,
      clickPath: definition.clickPath,
      createdBy: userId,
      metadata: { category, feedbackId },
      pushEnabled: definition.pushEnabled,
      title: "새 피드백이 등록되었습니다.",
      type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    });
  } catch (error) {
    await recordAdminFeedbackNotificationFailure(error, feedbackId, userId);
  }
}

export async function deleteFeedbackAction(feedbackId: string) {
  if (!z.string().uuid().safeParse(feedbackId).success) {
    return { error: "잘못된 요청입니다" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  const { data: feedback, error: fetchError } = await supabase
    .from("feedbacks")
    .select("id, image_urls")
    .eq("id", feedbackId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("[deleteFeedbackAction] 조회 실패:", fetchError);
    return { error: "문의사항 삭제에 실패했습니다" };
  }

  if (!feedback) {
    return { error: "삭제할 수 없습니다. 이미 삭제된 문의사항입니다" };
  }

  // RLS(feedbacks_delete_own_before_reply)와 동일한 규칙을 미리 확인해
  // 답변이 달린 문의에 더 친절한 에러 메시지를 준다. 최종 판단은 아래
  // DB 삭제 시점의 RLS가 다시 내리므로 여기서 통과해도 안전이 보장되지는 않는다.
  const { count: replyCount, error: replyError } = await supabase
    .from("feedback_replies")
    .select("id", { count: "exact", head: true })
    .eq("feedback_id", feedbackId);

  if (replyError) {
    console.error("[deleteFeedbackAction] 답변 조회 실패:", replyError);
    return { error: "문의사항 삭제에 실패했습니다" };
  }

  if (replyCount && replyCount > 0) {
    return { error: "삭제할 수 없습니다. 답변이 등록된 문의사항입니다" };
  }

  // DB 행 삭제를 먼저 확정한다. RLS(feedbacks_delete_own_before_reply)가
  // 위 사전 확인 이후 새로 달린 답변까지 최종적으로 다시 검증하며,
  // 정책에 걸리면 에러 없이 0건 삭제로 끝나므로 반환 행 유무로 판별한다.
  // 이미지는 행 삭제가 확정된 뒤에만 지워, 삭제가 막힌 문의의 첨부
  // 이미지가 먼저 유실되는 상황을 방지한다.
  const { data: deleted, error: deleteError } = await supabase
    .from("feedbacks")
    .delete()
    .eq("id", feedbackId)
    .eq("user_id", user.id)
    .select("id");

  if (deleteError) {
    console.error("[deleteFeedbackAction] 삭제 실패:", deleteError);
    return { error: "문의사항 삭제에 실패했습니다" };
  }

  if (!deleted?.[0]) {
    return {
      error:
        "삭제할 수 없습니다. 답변이 등록되었거나 이미 삭제된 문의사항입니다",
    };
  }

  // 행은 이미 삭제되었으므로 Storage 정리가 실패해도 사용자에게는
  // 성공으로 응답한다. 실패 시 고아 파일이 남을 수 있어 로그만 남긴다.
  const imagesRemoved = await removeFeedbackImages(
    supabase,
    feedback.image_urls,
  );

  if (!imagesRemoved) {
    console.error(
      "[deleteFeedbackAction] 이미지 정리 실패, 고아 파일 발생:",
      feedbackId,
    );
  }

  return { data: { success: true as const } };
}
