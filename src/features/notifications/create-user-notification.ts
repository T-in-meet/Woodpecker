import {
  NOTIFICATION_OPERATIONAL_ERROR_CODES,
  NOTIFICATION_OPERATIONAL_ERROR_FEATURES,
  NOTIFICATION_OPERATIONAL_ERROR_STAGES,
  type NotificationOperationalErrorOperationType,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import {
  NOTIFICATION_STATUS,
  type NotificationKindType,
} from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import { dispatchPushToUser } from "./dispatch-push";

type CreateUserNotificationInput = {
  actorUserId?: string | null;
  body?: string | null;
  clickPath: string;
  metadata?: Record<string, Json>;
  noteId?: string | null;
  operation: NotificationOperationalErrorOperationType;
  pushEnabled?: boolean;
  reviewLogId?: string | null;
  title: string;
  type: NotificationKindType;
  userId: string;
};

export type CreateUserNotificationResult =
  | {
      id: string;
      ok: true;
    }
  | {
      error: unknown;
      ok: false;
    };

function withActorUserId(actorUserId: string | null | undefined) {
  return actorUserId === undefined ? {} : { actorUserId };
}

function createPushPayload(input: CreateUserNotificationInput, id: string) {
  return {
    ...(input.body ? { body: input.body } : {}),
    data: {
      ...(input.metadata ?? {}),
      notificationId: id,
      type: input.type,
      url: input.clickPath,
    },
    title: input.title,
  };
}

/**
 * 사용자 인앱 알림을 생성하고, 타입 정책에 따라 Push 전송까지 시도합니다.
 *
 * 인앱 알림 생성 실패는 운영 오류로 기록하고 실패 결과를 반환합니다.
 * Push 전송 실패는 dispatchPushToUser 내부에서 운영 오류로 남기며,
 * 이미 생성된 인앱 알림을 되돌리지 않습니다.
 */
export async function createUserNotification(
  input: CreateUserNotificationInput,
): Promise<CreateUserNotificationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      body: input.body ?? null,
      click_path: input.clickPath,
      metadata: input.metadata ?? {},
      note_id: input.noteId ?? null,
      review_log_id: input.reviewLogId ?? null,
      status: NOTIFICATION_STATUS.SENT,
      title: input.title,
      type: input.type,
      user_id: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    await reportOperationalError({
      ...withActorUserId(input.actorUserId),
      context: {
        clickPath: input.clickPath,
        metadata: input.metadata ?? {},
        notificationType: input.type,
        userId: input.userId,
      },
      error,
      errorCode:
        NOTIFICATION_OPERATIONAL_ERROR_CODES.NOTIFICATION_CREATE_FAILED,
      feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
      message: "사용자 인앱 알림 생성에 실패했습니다.",
      operation: input.operation,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE,
      userId: input.userId,
    });

    return { error, ok: false };
  }

  if (input.pushEnabled !== false) {
    await dispatchPushToUser(createPushPayload(input, data.id), {
      ...(input.actorUserId === undefined
        ? {}
        : { actorUserId: input.actorUserId }),
      operation: input.operation,
      userId: input.userId,
    });
  }

  return { id: data.id, ok: true };
}
