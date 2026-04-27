import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, sendPushMock, setVapidDetailsMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    sendPushMock: vi.fn(),
    setVapidDetailsMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/webPush", () => ({
  sendPush: sendPushMock,
  setVapidDetails: setVapidDetailsMock,
}));

import * as dispatchRoute from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const SUBSCRIPTION_ID = "55555555-5555-4555-8555-555555555555";
const ENDPOINT = "https://push.example.test/subscription-id";
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
  insertedNotification = { id: NOTIFICATION_ID },
  note = { title: "알림 노트" },
  subscriptions = [
    {
      auth: "auth-secret",
      endpoint: ENDPOINT,
      id: SUBSCRIPTION_ID,
      p256dh: "p256dh-key",
    },
  ],
}: {
  claimedLogs?: (typeof CLAIMED_LOG)[];
  insertedNotification?: { id: string } | null;
  note?: { title: string } | null;
  subscriptions?: {
    auth: string;
    endpoint: string;
    id: string;
    p256dh: string;
  }[];
} = {}) {
  const rpcMock = vi.fn().mockResolvedValue({
    data: claimedLogs,
    error: null,
  });

  const notesMaybeSingleMock = vi.fn().mockResolvedValue({
    data: note,
    error: null,
  });
  const notesUserEqMock = vi.fn().mockReturnValue({
    maybeSingle: notesMaybeSingleMock,
  });
  const notesIdEqMock = vi.fn().mockReturnValue({
    eq: notesUserEqMock,
  });
  const notesSelectMock = vi.fn().mockReturnValue({
    eq: notesIdEqMock,
  });

  const subscriptionsEqMock = vi.fn().mockResolvedValue({
    data: subscriptions,
    error: null,
  });
  const subscriptionsSelectMock = vi.fn().mockReturnValue({
    eq: subscriptionsEqMock,
  });
  const deleteSubscriptionEqMock = vi.fn().mockResolvedValue({ error: null });
  const deleteSubscriptionMock = vi.fn().mockReturnValue({
    eq: deleteSubscriptionEqMock,
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

  const reviewLogUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const reviewLogUpdateMock = vi.fn().mockReturnValue({
    eq: reviewLogUpdateEqMock,
  });

  const fromMock = vi.fn((table: string) => {
    if (table === "notes") {
      return {
        select: notesSelectMock,
      };
    }

    if (table === "push_subscriptions") {
      return {
        delete: deleteSubscriptionMock,
        select: subscriptionsSelectMock,
      };
    }

    if (table === "notifications") {
      return {
        upsert: notificationUpsertMock,
      };
    }

    if (table === "review_logs") {
      return {
        update: reviewLogUpdateMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    deleteSubscriptionEqMock,
    fromMock,
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
    sendPushMock.mockReset();
    setVapidDetailsMock.mockReset();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    sendPushMock.mockResolvedValue({ ok: true });
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
    expect(setVapidDetailsMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("claim_due_review_logs", {
      p_limit: 200,
    });
    expect(notificationUpsertMock).toHaveBeenCalledWith(
      {
        body: "알림 노트",
        note_id: NOTE_ID,
        review_log_id: REVIEW_LOG_ID,
        status: "SENT",
        title: "복습 시간이에요",
        type: "REVIEW",
        user_id: USER_ID,
      },
      { ignoreDuplicates: true, onConflict: "review_log_id,type" },
    );
    expect(reviewLogUpdateMock).toHaveBeenCalledWith({
      notification_dispatched_at: expect.any(String),
    });
    expect(sendPushMock).toHaveBeenCalledWith(
      {
        endpoint: ENDPOINT,
        keys: {
          auth: "auth-secret",
          p256dh: "p256dh-key",
        },
      },
      {
        body: "알림 노트",
        data: {
          noteId: NOTE_ID,
          notificationId: NOTIFICATION_ID,
          reviewLogId: REVIEW_LOG_ID,
          url: `/notes/${NOTE_ID}/review`,
        },
        title: "복습 시간이에요",
      },
    );
  });

  it("deletes expired push subscriptions", async () => {
    const { deleteSubscriptionEqMock, supabase } = createSupabaseMock();
    createAdminClientMock.mockReturnValue(supabase);
    sendPushMock.mockResolvedValue({ gone: true, ok: false });

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      expiredSubscriptions: 1,
      pushFailed: 0,
      pushed: 0,
    });
    expect(deleteSubscriptionEqMock).toHaveBeenCalledWith(
      "id",
      SUBSCRIPTION_ID,
    );
  });

  it("does not send duplicate push when the notification already exists", async () => {
    const { supabase } = createSupabaseMock({
      insertedNotification: null,
    });
    createAdminClientMock.mockReturnValue(supabase);

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      dispatched: 1,
      pushed: 0,
    });
    expect(sendPushMock).not.toHaveBeenCalled();
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
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("counts non-expired push failures separately", async () => {
    const { supabase } = createSupabaseMock({
      subscriptions: [
        {
          auth: "auth-secret",
          endpoint: ENDPOINT,
          id: SUBSCRIPTION_ID,
          p256dh: "p256dh-key",
        },
        {
          auth: "second-auth-secret",
          endpoint: "https://push.example.test/second-subscription-id",
          id: "66666666-6666-4666-8666-666666666666",
          p256dh: "second-p256dh-key",
        },
      ],
    });
    createAdminClientMock.mockReturnValue(supabase);
    sendPushMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });

    const response = await dispatchRoute.GET(createAuthorizedRequest());

    await expect(response.json()).resolves.toMatchObject({
      itemFailed: 0,
      pushFailed: 1,
      pushed: 1,
    });
  });
});
