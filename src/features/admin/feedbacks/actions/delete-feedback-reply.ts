"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteFeedbackReplyResult =
  | { ok: true }
  | { ok: false; message: string };

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
  await assertAdmin();

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

/**
 * 현재 세션 사용자가 관리자 답변을 삭제할 수 있는지 확인합니다.
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
}
