import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, dispatchPushToUserMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  dispatchPushToUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/notifications/dispatch-push", () => ({
  dispatchPushToUser: dispatchPushToUserMock,
}));

import * as dispatchRoute from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const CRON_URL = "http://localhost/api/cron/dispatch-notifications";

const CLAIMED_LOG = {
  id: REVIEW_LOG_ID,
  note_id: NOTE_ID,
  round: 1,
  scheduled_at: "2026-04-27T00:00:00.000Z",
  user_id: USER_ID,
};

function createAuthorizedRequest() {
  return new Request(CRON_URL, {
    headers: {
      authorization: "Bearer cron-secret",
    },
  });
}

function createSupabaseMock({
  claimedLogs = [CLAIMED_LOG],
  existingNotification = { id: NOTIFICATION_ID, status: "SENT" },
  finalNote = { review_completed_at: null },
  insertedNotification = { id: NOTIFICATION_ID },
  note = { review_completed_at: null, title: "알림 노트" },
  // 재무장 직후 첫 claim이면 1. 같은 회차의 발송 재시도는 2 이상이 된다.
  reviewLogDispatchAttempts = 1,
}: {
  claimedLogs?: (typeof CLAIMED_LOG)[] | null;
  existingNotification?: { id: string; status: string } | null;
  finalNote?: { review_completed_at: string | null } | null;
  insertedNotification?: { id: string } | null;
  note?: { review_completed_at: string | null; title: string } | null;
  reviewLogDispatchAttempts?: number;
} = {}) {
  const rpcMock = vi.fn().mockResolvedValue({
    data: claimedLogs,
    error: null,
  });

  const notesMaybeSingleMock = vi
    .fn()
    .mockResolvedValueOnce({ data: note, error: null })
    .mockResolvedValueOnce({ data: finalNote, error: null });
  const notesUserEqMock = vi.fn().mockReturnValue({
    maybeSingle: notesMaybeSingleMock,
  });
  const notesIdEqMock = vi.fn().mockReturnValue({
    eq: notesUserEqMock,
  });
  const notesSelectMock = vi.fn().mockReturnValue({
    eq: notesIdEqMock,
  });

  const notificationUpsertMaybeSingleMock = vi.fn().mockResolvedValue({
    data: insertedNotification,
    error: null,
  });
  const notificationUpsertSelectMock = vi.fn().mockReturnValue({
    maybeSingle: notificationUpsertMaybeSingleMock,
  });
  const notificationUpsertMock = vi.fn().mockReturnValue({
    select: notificationUpsertSelectMock,
  });
  const notificationSelectMaybeSingleMock = vi.fn().mockResolvedValue({
    data: existingNotification,
    error: null,
  });
  const notificationSelectUserEqMock = vi.fn().mockReturnValue({
    maybeSingle: notificationSelectMaybeSingleMock,
  });
  const notificationSelectTypeEqMock = vi.fn().mockReturnValue({
    eq: notificationSelectUserEqMock,
  });
  const notificationSelectReviewLogEqMock = vi.fn().mockReturnValue({
    eq: notificationSelectTypeEqMock,
  });
  const notificationSelectMock = vi.fn().mockReturnValue({
    eq: notificationSelectReviewLogEqMock,
  });
  const notificationUpdateStatusEqMock = vi
    .fn()
    .mockResolvedValue({ error: null });
  const notificationUpdateTypeEqMock = vi.fn().mockReturnValue({
    eq: notificationUpdateStatusEqMock,
  });
  const notificationUpdateUserEqMock = vi.fn().mockReturnValue({
    eq: notificationUpdateTypeEqMock,
  });
  const notificationUpdateIdEqMock = vi.fn().mockReturnValue({
    eq: notificationUpdateUserEqMock,
  });
  const notificationUpdateMock = vi.fn().mockReturnValue({
    eq: notificationUpdateIdEqMock,
  });

  const reviewLogUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const reviewLogUpdateMock = vi.fn().mockReturnValue({
    eq: reviewLogUpdateEqMock,
  });

  const reviewLogSelectMaybeSingleMock = vi.fn().mockResolvedValue({
    data: { notification_dispatch_attempts: reviewLogDispatchAttempts },
    error: null,
  });
  const reviewLogSelectUserEqMock = vi.fn().mockReturnValue({
    maybeSingle: reviewLogSelectMaybeSingleMock,
  });
  const reviewLogSelectIdEqMock = vi.fn().mockReturnValue({
    eq: reviewLogSelectUserEqMock,
  });
  const reviewLogSelectMock = vi.fn().mockReturnValue({
    eq: reviewLogSelectIdEqMock,
  });

  const fromMock = vi.fn((table: string) => {
    if (table === "notes") {
      return {
        select: notesSelectMock,
      };
    }

    if (table === "notifications") {
      return {
        select: notificationSelectMock,
        update: notificationUpdateMock,
        upsert: notificationUpsertMock,
      };
    }

    if (table === "review_logs") {
      return {
        select: reviewLogSelectMock,
        update: reviewLogUpdateMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    fromMock,
    notificationSelectMock,
    notificationUpdateMock,
    notificationUpdateStatusEqMock,
    notificationUpsertMock,
    reviewLogUpdateMock,
    rpcMock,
    supabase: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
}

describe("/api/cron/dispatch-notifications", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    dispatchPushToUserMock.mockReset();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    dispatchPushToUserMock.mockResolvedValue({
      expiredSubscriptions: 0,
      failed: 0,
      sent: 1,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects requests without the cron bearer token", async () => {
    const response = await dispatchRoute.GET(new Request(CRON_URL));

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns a server error when the cron secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toEqual({
      error: "cron_secret_missing",
    });
    expect(response.status).toBe(500);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("claims due review logs, creates an in-app notification, and sends push", async () => {
    const { notificationUpsertMock, reviewLogUpdateMock, rpcMock, supabase } =
      createSupabaseMock();
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toEqual({
      claimed: 1,
      dispatched: 1,
      expiredSubscriptions: 0,
      itemFailed: 0,
      pushFailed: 0,
      pushed: 1,
    });
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("claim_due_review_logs", {
      p_limit: 200,
    });
    expect(notificationUpsertMock).toHaveBeenCalledWith(
      {
        body: "알림 노트",
        click_path: `/notes/${NOTE_ID}/review`,
        metadata: {
          noteId: NOTE_ID,
          reviewLogId: REVIEW_LOG_ID,
        },
        note_id: NOTE_ID,
        review_log_id: REVIEW_LOG_ID,
        status: "SENT",
        title: "복습할 시간이에요!",
        type: "REVIEW",
        user_id: USER_ID,
      },
      { ignoreDuplicates: true, onConflict: "review_log_id,type" },
    );
    expect(reviewLogUpdateMock).toHaveBeenCalledWith({
      notification_dispatched_at: expect.any(String),
    });
    expect(dispatchPushToUserMock).toHaveBeenCalledWith(
      {
        body: '"알림 노트" 복습할 시간이에요.',
        data: {
          noteId: NOTE_ID,
          notificationId: NOTIFICATION_ID,
          reviewLogId: REVIEW_LOG_ID,
          type: "REVIEW",
          url: `/notes/${NOTE_ID}/review`,
        },
        title: "복습할 시간이에요!",
      },
      {
        operation: "dispatch_push",
        userId: USER_ID,
      },
    );
  });

  it("treats null claim data as an empty batch", async () => {
    const { fromMock, supabase } = createSupabaseMock({
      claimedLogs: null,
    });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toEqual({
      claimed: 0,
      dispatched: 0,
      expiredSubscriptions: 0,
      itemFailed: 0,
      pushFailed: 0,
      pushed: 0,
    });
    expect(response.status).toBe(200);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("skips notifications for a note completed after it was claimed", async () => {
    const { notificationUpsertMock, reviewLogUpdateMock, supabase } =
      createSupabaseMock({
        note: {
          review_completed_at: "2026-04-27T00:05:00.000Z",
          title: "완료한 노트",
        },
      });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      claimed: 1,
      dispatched: 0,
      itemFailed: 0,
      pushed: 0,
    });
    expect(notificationUpsertMock).not.toHaveBeenCalled();
    expect(dispatchPushToUserMock).not.toHaveBeenCalled();
    expect(reviewLogUpdateMock).not.toHaveBeenCalled();
  });

  it("consumes a notification when the note is completed before push", async () => {
    const {
      notificationUpdateMock,
      notificationUpdateStatusEqMock,
      reviewLogUpdateMock,
      supabase,
    } = createSupabaseMock({
      finalNote: { review_completed_at: "2026-04-27T00:05:00.000Z" },
    });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      claimed: 1,
      dispatched: 0,
      itemFailed: 0,
      pushed: 0,
    });
    expect(notificationUpdateMock).toHaveBeenCalledWith({
      read_at: expect.any(String),
      status: "READ",
    });
    expect(notificationUpdateStatusEqMock).toHaveBeenCalledWith(
      "status",
      "SENT",
    );
    expect(dispatchPushToUserMock).not.toHaveBeenCalled();
    expect(reviewLogUpdateMock).not.toHaveBeenCalled();
  });

  it("includes expired push subscription stats from push dispatch", async () => {
    const { supabase } = createSupabaseMock();
    createAdminClientMock.mockReturnValue(supabase);
    dispatchPushToUserMock.mockResolvedValue({
      expiredSubscriptions: 1,
      failed: 0,
      sent: 0,
    });

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      expiredSubscriptions: 1,
      pushFailed: 0,
      pushed: 0,
    });
  });

  it("retries push when the notification already exists but the review log is still due", async () => {
    const { notificationSelectMock, reviewLogUpdateMock, supabase } =
      createSupabaseMock({
        insertedNotification: null,
      });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 1,
      pushed: 1,
    });
    expect(notificationSelectMock).toHaveBeenCalledWith("id, status");
    expect(dispatchPushToUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationId: NOTIFICATION_ID,
          reviewLogId: REVIEW_LOG_ID,
        }),
      }),
      {
        operation: "dispatch_push",
        userId: USER_ID,
      },
    );
    expect(reviewLogUpdateMock).toHaveBeenCalledWith({
      notification_dispatched_at: expect.any(String),
    });
  });

  // 완료 -> 재시작을 거친 로그는 이미 READ로 소비된 알림 행을 재사용한다.
  // 되돌리지 않으면 푸시는 다시 나가는데 벨에는 뜨지 않는다.
  it("rearms a consumed notification row before pushing it again", async () => {
    const { notificationUpdateMock, supabase } = createSupabaseMock({
      existingNotification: { id: NOTIFICATION_ID, status: "READ" },
      insertedNotification: null,
    });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 1,
      pushed: 1,
    });
    expect(notificationUpdateMock).toHaveBeenCalledWith({
      read_at: null,
      sent_at: expect.any(String),
      status: "SENT",
    });
  });

  // 같은 회차의 발송 재시도(attempts > 1)에서 READ는 이번 발송을 보고 사용자가
  // 직접 확인했다는 뜻이다. 되돌리면 이미 치운 알림이 안 읽음으로 되살아난다.
  it("keeps a notification the user already read when retrying the same dispatch", async () => {
    const { notificationUpdateMock, supabase } = createSupabaseMock({
      existingNotification: { id: NOTIFICATION_ID, status: "READ" },
      insertedNotification: null,
      reviewLogDispatchAttempts: 2,
    });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 1,
      pushed: 1,
    });
    expect(notificationUpdateMock).not.toHaveBeenCalled();
  });

  it("does not create a notification when the note is missing", async () => {
    const { notificationUpsertMock, reviewLogUpdateMock, supabase } =
      createSupabaseMock({
        note: null,
      });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 0,
      itemFailed: 1,
      pushed: 0,
    });
    expect(notificationUpsertMock).not.toHaveBeenCalled();
    expect(reviewLogUpdateMock).not.toHaveBeenCalled();
    expect(dispatchPushToUserMock).not.toHaveBeenCalled();
  });

  it("leaves review logs retryable when a non-expired push fails", async () => {
    const { reviewLogUpdateMock, supabase } = createSupabaseMock();
    createAdminClientMock.mockReturnValue(supabase);
    dispatchPushToUserMock.mockResolvedValue({
      expiredSubscriptions: 0,
      failed: 1,
      sent: 1,
    });

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 0,
      itemFailed: 0,
      pushFailed: 1,
      pushed: 1,
    });
    expect(reviewLogUpdateMock).not.toHaveBeenCalled();
  });
});
