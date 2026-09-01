import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { dispatchPushToUser } from "@/features/notifications/dispatch-push";
import { NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS } from "@/features/operational-errors/constants";
import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";
import { getNoteReviewRoute } from "@/lib/constants/routes";
import { logError, logWarn } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** 한 번의 Cron 실행에서 claim할 최대 복습 로그 수 */
const CLAIM_LIMIT = 200;

/** claim된 복습 로그를 동시에 처리할 최대 작업 수 */
const CLAIM_CONCURRENCY = 8;

/** 복습 알림에 공통으로 사용하는 제목 */
const REVIEW_NOTIFICATION_TITLE = "복습할 시간이에요!";

/**
 * 발송 처리를 위해 claim된 복습 로그입니다.
 */
type ClaimedReviewLogType = {
  id: string;
  note_id: string;
  round: number;
  scheduled_at: string;
  user_id: string;
};

/**
 * Cron 실행 전체의 처리 결과 통계입니다.
 */
type DispatchStatsType = {
  /** 이번 실행에서 claim한 복습 로그 수 */
  claimed: number;

  /** 발송 완료 상태로 변경한 복습 로그 수 */
  dispatched: number;

  /** 만료되어 제거된 Push 구독 수 */
  expiredSubscriptions: number;

  /** 알림 항목 처리 자체에 실패한 수 */
  itemFailed: number;

  /** Push 전송에 실패한 구독 수 */
  pushFailed: number;

  /** Push 전송에 성공한 구독 수 */
  pushed: number;
};

/**
 * 개별 복습 로그의 처리 결과 통계입니다.
 *
 * `claimed`는 전체 Cron 실행 단계에서 계산하므로 포함하지 않습니다.
 */
type DispatchItemStatsType = Omit<DispatchStatsType, "claimed">;

/**
 * 복습 알림 생성 또는 조회 결과입니다.
 */
type EnsureNotificationResultType = {
  id: string;
};

/**
 * 비밀 값을 일정한 길이의 SHA-256 해시로 변환합니다.
 *
 * `timingSafeEqual()`은 같은 길이의 Buffer만 비교할 수 있으므로
 * 비교 전에 두 문자열을 동일한 길이의 해시로 변환합니다.
 *
 * @param value 해시로 변환할 문자열
 * @returns SHA-256 해시 Buffer
 */
function hashSecretValue(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * 두 문자열을 타이밍 공격에 안전한 방식으로 비교합니다.
 *
 * @param left 비교할 첫 번째 문자열
 * @param right 비교할 두 번째 문자열
 * @returns 두 문자열이 같으면 `true`
 */
function timingSafeStringEqual(left: string, right: string): boolean {
  return timingSafeEqual(hashSecretValue(left), hashSecretValue(right));
}

/**
 * Cron 인증에 필요한 환경 변수의 설정 여부를 확인합니다.
 *
 * @returns 설정 오류가 있으면 오류 응답, 없으면 `null`
 */
function getSecretErrorResponse(): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logError({ event: "cron.dispatchNotifications.secretMissing" });
    return NextResponse.json({ error: "cron_secret_missing" }, { status: 500 });
  }

  return null;
}

/**
 * 요청의 Authorization 헤더를 이용해 Cron 호출을 인증합니다.
 *
 * @param request Cron 호출 요청
 * @returns 인증에 실패하면 오류 응답, 성공하면 `null`
 */
function authorizeCronRequest(request: Request): NextResponse | null {
  const secretError = getSecretErrorResponse();

  if (secretError) {
    return secretError;
  }

  const expectedAuthorization = `Bearer ${process.env.CRON_SECRET}`;
  const authorization = request.headers.get("authorization") ?? "";

  if (!timingSafeStringEqual(authorization, expectedAuthorization)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * 복습 알림 클릭 시 이동할 노트 복습 경로를 생성합니다.
 *
 * @param noteId 복습할 노트 ID
 * @returns 노트 복습 경로
 */
function buildReviewUrl(noteId: string): string {
  return getNoteReviewRoute(noteId);
}

/**
 * 노트 제목을 이용해 복습 Push 알림 본문을 생성합니다.
 *
 * @param noteTitle 복습할 노트 제목
 * @returns Push 알림 본문
 */
function buildReviewNotificationBody(noteTitle: string): string {
  return `"${noteTitle}" 복습할 시간이에요.`;
}

/**
 * 복습 Push 전송에 사용할 payload를 생성합니다.
 *
 * 알림 클릭 처리와 클라이언트 상태 갱신에 필요한 노트, 알림,
 * 복습 로그 식별자를 `data`에 포함합니다.
 *
 * @param params Push payload 생성에 필요한 복습 알림 정보
 * @returns 공통 Push 전송 함수에 전달할 payload
 */
function buildPushPayload({
  noteId,
  noteTitle,
  notificationId,
  reviewLogId,
}: {
  noteId: string;
  noteTitle: string;
  notificationId: string;
  reviewLogId: string;
}) {
  const url = buildReviewUrl(noteId);

  return {
    title: REVIEW_NOTIFICATION_TITLE,
    body: buildReviewNotificationBody(noteTitle),
    data: {
      noteId,
      notificationId,
      reviewLogId,
      url,
    },
  };
}

/**
 * claim된 복습 로그에 대응하는 알림을 생성하거나 기존 알림을 반환합니다.
 *
 * `review_log_id`와 `type`을 충돌 기준으로 사용하여 Cron 재실행이나
 * Push 재시도 과정에서 같은 복습 알림이 중복 생성되지 않도록 합니다.
 *
 * 충돌로 인해 새로운 row가 반환되지 않으면 기존 알림을 다시 조회합니다.
 *
 * @param supabase 관리자 권한 Supabase 클라이언트
 * @param claimedLog 발송 처리를 위해 claim된 복습 로그
 * @param noteTitle 복습 대상 노트 제목
 * @returns 생성하거나 조회한 알림 ID
 */
async function ensureNotification(
  supabase: ReturnType<typeof createAdminClient>,
  claimedLog: ClaimedReviewLogType,
  noteTitle: string,
): Promise<EnsureNotificationResultType> {
  const { data, error } = await supabase
    .from("notifications")
    .upsert(
      {
        body: noteTitle,
        click_path: buildReviewUrl(claimedLog.note_id),
        metadata: {
          noteId: claimedLog.note_id,
          reviewLogId: claimedLog.id,
        },
        note_id: claimedLog.note_id,
        review_log_id: claimedLog.id,
        status: NOTIFICATION_STATUS.SENT,
        title: REVIEW_NOTIFICATION_TITLE,
        type: NOTIFICATION_TYPES.REVIEW,
        user_id: claimedLog.user_id,
      },
      { ignoreDuplicates: true, onConflict: "review_log_id,type" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    return { id: data.id };
  }

  // 충돌로 insert가 생략된 경우 기존 복습 알림을 다시 조회합니다.
  const { data: existingNotification, error: existingNotificationError } =
    await supabase
      .from("notifications")
      .select("id")
      .eq("review_log_id", claimedLog.id)
      .eq("type", NOTIFICATION_TYPES.REVIEW)
      .eq("user_id", claimedLog.user_id)
      .maybeSingle();

  if (existingNotificationError) {
    throw existingNotificationError;
  }

  if (!existingNotification?.id) {
    throw new Error(
      "Existing notification was not found after upsert conflict.",
    );
  }

  return { id: existingNotification.id };
}

/**
 * 복습 로그를 알림 발송 완료 상태로 변경합니다.
 *
 * Push 전송 실패가 없는 경우에만 호출하여, 실패한 복습 알림을
 * 다음 Cron 실행에서 다시 시도할 수 있도록 합니다.
 *
 * @param supabase 관리자 권한 Supabase 클라이언트
 * @param reviewLogId 발송 완료로 처리할 복습 로그 ID
 */
async function markReviewLogDispatched(
  supabase: ReturnType<typeof createAdminClient>,
  reviewLogId: string,
): Promise<void> {
  const { error } = await supabase
    .from("review_logs")
    .update({ notification_dispatched_at: new Date().toISOString() })
    .eq("id", reviewLogId);

  if (error) {
    throw error;
  }
}

/**
 * claim 뒤 완료된 노트에 이미 만들어진 복습 알림을 벨에서 소비합니다.
 *
 * 완료 RPC보다 notification 생성이 늦게 끝난 경쟁 상황에서는 완료 RPC가 읽음
 * 처리할 행이 없었으므로, dispatcher가 외부 Push를 건너뛰기 전에 직접 정리합니다.
 */
async function markReviewNotificationRead(
  supabase: ReturnType<typeof createAdminClient>,
  notificationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
      status: NOTIFICATION_STATUS.READ,
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("type", NOTIFICATION_TYPES.REVIEW)
    .eq("status", NOTIFICATION_STATUS.SENT);

  if (error) {
    throw error;
  }
}

/**
 * claim된 복습 로그 하나의 알림 생성과 Push 전송을 처리합니다.
 *
 * 복습 알림의 중복 방지와 `review_logs` 상태 관리는 이 함수에서
 * 유지하고, 실제 Push 구독 조회 및 전송은 `dispatchPushToUser()`에
 * 위임합니다.
 *
 * Push 전송 실패가 하나라도 있으면 복습 로그를 발송 완료로 변경하지
 * 않아 다음 Cron 실행에서 재시도할 수 있도록 합니다.
 *
 * @param supabase 관리자 권한 Supabase 클라이언트
 * @param claimedLog 처리할 복습 로그
 * @returns 해당 복습 로그의 처리 통계
 */
async function dispatchClaimedReviewLog(
  supabase: ReturnType<typeof createAdminClient>,
  claimedLog: ClaimedReviewLogType,
): Promise<DispatchItemStatsType> {
  const stats = {
    dispatched: 0,
    expiredSubscriptions: 0,
    itemFailed: 0,
    pushFailed: 0,
    pushed: 0,
  };

  try {
    const noteResult = await supabase
      .from("notes")
      .select("title, review_completed_at")
      .eq("id", claimedLog.note_id)
      .eq("user_id", claimedLog.user_id)
      .maybeSingle();

    if (noteResult.error) {
      throw noteResult.error;
    }

    if (!noteResult.data) {
      stats.itemFailed += 1;
      logWarn({
        event: "cron.dispatchNotifications.noteMissing",
        noteId: claimedLog.note_id,
        reviewLogId: claimedLog.id,
        userId: claimedLog.user_id,
      });
      return stats;
    }

    if (noteResult.data.review_completed_at) {
      logWarn({
        event: "cron.dispatchNotifications.noteReviewCompleted",
        noteId: claimedLog.note_id,
        reviewLogId: claimedLog.id,
        userId: claimedLog.user_id,
      });
      return stats;
    }

    const noteTitle = noteResult.data.title;
    const notification = await ensureNotification(
      supabase,
      claimedLog,
      noteTitle,
    );

    // claim과 첫 note 조회 뒤 사용자가 완료할 수 있으므로 외부 Push 직전에 다시
    // 확인한다. 이 확인 뒤의 완료는 이미 외부 발송이 시작된 것으로 취급한다.
    const finalNoteResult = await supabase
      .from("notes")
      .select("review_completed_at")
      .eq("id", claimedLog.note_id)
      .eq("user_id", claimedLog.user_id)
      .maybeSingle();

    if (finalNoteResult.error) {
      throw finalNoteResult.error;
    }

    if (!finalNoteResult.data) {
      stats.itemFailed += 1;
      logWarn({
        event: "cron.dispatchNotifications.noteMissingBeforePush",
        noteId: claimedLog.note_id,
        reviewLogId: claimedLog.id,
        userId: claimedLog.user_id,
      });
      return stats;
    }

    if (finalNoteResult.data.review_completed_at) {
      await markReviewNotificationRead(
        supabase,
        notification.id,
        claimedLog.user_id,
      );
      logWarn({
        event: "cron.dispatchNotifications.noteReviewCompletedBeforePush",
        noteId: claimedLog.note_id,
        reviewLogId: claimedLog.id,
        userId: claimedLog.user_id,
      });
      return stats;
    }

    const payload = buildPushPayload({
      noteId: claimedLog.note_id,
      noteTitle,
      notificationId: notification.id,
      reviewLogId: claimedLog.id,
    });

    // Push 구독 조회, 전송, 만료 구독 삭제 및 오류 기록은
    // 공통 Push 전송 계층에서 처리합니다.
    const pushResult = await dispatchPushToUser(payload, {
      operation: NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
      userId: claimedLog.user_id,
    });

    // 공통 Push 함수의 결과를 기존 Cron 응답 통계에 맞게 변환합니다.
    stats.expiredSubscriptions += pushResult.expiredSubscriptions;
    stats.pushFailed += pushResult.failed;
    stats.pushed += pushResult.sent;

    if (pushResult.failed > 0) {
      // Web Push에는 구독별 발송 완료 상태가 없으므로 실패가 하나라도
      // 있으면 복습 로그를 완료 처리하지 않고 다음 Cron에서 재시도합니다.
      return stats;
    }

    await markReviewLogDispatched(supabase, claimedLog.id);
    stats.dispatched += 1;
  } catch (error) {
    stats.itemFailed += 1;
    logError({
      event: "cron.dispatchNotifications.itemFailed",
      error,
      reviewLogId: claimedLog.id,
    });
  }

  return stats;
}

/**
 * 개별 복습 로그의 처리 통계를 Cron 전체 통계에 누적합니다.
 *
 * @param current 누적할 Cron 전체 통계
 * @param next 개별 복습 로그의 처리 통계
 */
function addDispatchStats(
  current: DispatchStatsType,
  next: DispatchItemStatsType,
): void {
  current.dispatched += next.dispatched;
  current.expiredSubscriptions += next.expiredSubscriptions;
  current.itemFailed += next.itemFailed;
  current.pushFailed += next.pushFailed;
  current.pushed += next.pushed;
}

/**
 * 주어진 작업 목록을 지정된 동시 실행 제한 안에서 처리합니다.
 *
 * 결과 배열은 입력 배열과 동일한 순서를 유지합니다.
 *
 * @param items 처리할 항목 목록
 * @param concurrency 동시에 실행할 최대 작업 수
 * @param task 각 항목을 처리할 비동기 함수
 * @returns 각 항목의 처리 결과 배열
 */
async function runWithConcurrencyLimit<ItemType, ResultType>(
  items: readonly ItemType[],
  concurrency: number,
  task: (item: ItemType) => Promise<ResultType>,
): Promise<ResultType[]> {
  const results = new Array<ResultType>(items.length);
  const iterator = items.entries();
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        const [index, item] = next.value;
        results[index] = await task(item);
      }
    }),
  );

  return results;
}

/**
 * 발송 시간이 지난 복습 로그를 claim하고 알림과 Push를 처리합니다.
 *
 * 요청은 `CRON_SECRET`을 이용해 인증하며, claim된 복습 로그는 제한된
 * 동시 실행 수로 처리합니다. 각 로그의 Push 전송이 모두 성공한 경우에만
 * `notification_dispatched_at`을 기록합니다.
 *
 * @param request Cron 호출 요청
 * @returns 전체 알림 발송 통계 또는 오류 응답
 */
export async function GET(request: Request) {
  const unauthorizedResponse = authorizeCronRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const supabase = createAdminClient();
    const { data: claimedLogRows, error } = await supabase.rpc(
      "claim_due_review_logs",
      { p_limit: CLAIM_LIMIT },
    );

    if (error) {
      logError({ event: "cron.dispatchNotifications.claimFailed", error });
      return NextResponse.json(
        { error: "notification_claim_failed" },
        { status: 500 },
      );
    }

    const claimedLogs = claimedLogRows ?? [];

    const stats: DispatchStatsType = {
      claimed: claimedLogs.length,
      dispatched: 0,
      expiredSubscriptions: 0,
      itemFailed: 0,
      pushFailed: 0,
      pushed: 0,
    };

    const claimedLogResults = await runWithConcurrencyLimit(
      claimedLogs,
      CLAIM_CONCURRENCY,
      (claimedLog) => dispatchClaimedReviewLog(supabase, claimedLog),
    );

    for (const nextStats of claimedLogResults) {
      addDispatchStats(stats, nextStats);
    }

    return NextResponse.json(stats);
  } catch (error) {
    logError({ event: "cron.dispatchNotifications.failed", error });
    return NextResponse.json(
      { error: "notification_dispatch_failed" },
      { status: 500 },
    );
  }
}
