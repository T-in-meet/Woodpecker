import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

/**
 * `.env.local`의 환경 변수를 현재 Node.js 프로세스에 불러옵니다.
 */
function loadLocalEnv() {
  if (!existsSync(".env.local")) return;

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local.",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = {
  admin: "11111111-1111-4111-8111-111111111111",
  userOne: "22222222-2222-4222-8222-222222222222",
  userTwo: "33333333-3333-4333-8333-333333333333",
};

const OPERATIONAL_ERROR_STATUS = {
  IGNORED: "IGNORED",
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
};

const OPERATIONAL_ERROR_SEVERITY = {
  ERROR: "ERROR",
  INFO: "INFO",
  WARN: "WARN",
};

const NOTIFICATION_OPERATIONAL_ERROR_FEATURES = {
  NOTIFICATIONS: "notifications",
};

const NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS = {
  CREATE_USER_NOTIFICATION: "create_user_notification",
  DISPATCH_PUSH: "dispatch_push",
};

const NOTIFICATION_OPERATIONAL_ERROR_STAGES = {
  IN_APP_NOTIFICATION_CREATE: "in_app_notification_create",
  PUSH_SEND: "push_send",
  PUSH_SUBSCRIPTION_CLEANUP: "push_subscription_cleanup",
};

const NOTIFICATION_OPERATIONAL_ERROR_CODES = {
  NOTIFICATION_CREATE_FAILED: "NOTIFICATION_CREATE_FAILED",
  PUSH_SEND_FAILED: "PUSH_SEND_FAILED",
  PUSH_SUBSCRIPTION_DELETE_FAILED: "PUSH_SUBSCRIPTION_DELETE_FAILED",
  PUSH_SUBSCRIPTION_GONE: "PUSH_SUBSCRIPTION_GONE",
};

const ADMIN_OPERATIONAL_ERROR_FEATURES = {
  ADMIN_OPERATIONAL_ERRORS: "admin_operational_errors",
};

const ADMIN_OPERATIONAL_ERROR_OPERATIONS = {
  GET_OPERATIONAL_ERROR_DETAIL: "get_operational_error_detail",
  LIST_OPERATIONAL_ERRORS: "list_operational_errors",
  UPDATE_OPERATIONAL_ERROR_STATUS: "update_operational_error_status",
};

const ADMIN_OPERATIONAL_ERROR_STAGES = {
  CURRENT_STATUS_QUERY: "current_status_query",
  DETAIL_QUERY: "detail_query",
  HISTORY_QUERY: "history_query",
  LIST_QUERY: "list_query",
  PROFILE_QUERY: "profile_query",
  STATUS_HISTORY_INSERT: "status_history_insert",
  STATUS_UPDATE: "status_update",
};

const ADMIN_OPERATIONAL_ERROR_CODES = {
  OPERATIONAL_ERROR_DETAIL_FAILED: "OPERATIONAL_ERROR_DETAIL_FAILED",
  OPERATIONAL_ERROR_HISTORY_FAILED: "OPERATIONAL_ERROR_HISTORY_FAILED",
  OPERATIONAL_ERROR_HISTORY_INSERT_FAILED:
    "OPERATIONAL_ERROR_HISTORY_INSERT_FAILED",
  OPERATIONAL_ERROR_LIST_FAILED: "OPERATIONAL_ERROR_LIST_FAILED",
  OPERATIONAL_ERROR_PROFILES_FAILED: "OPERATIONAL_ERROR_PROFILES_FAILED",
  OPERATIONAL_ERROR_STATUS_QUERY_FAILED:
    "OPERATIONAL_ERROR_STATUS_QUERY_FAILED",
  OPERATIONAL_ERROR_STATUS_UPDATE_FAILED:
    "OPERATIONAL_ERROR_STATUS_UPDATE_FAILED",
};

const operationalErrors = [
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    operation:
      NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.CREATE_USER_NOTIFICATION,
    stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE,
    error_code: NOTIFICATION_OPERATIONAL_ERROR_CODES.NOTIFICATION_CREATE_FAILED,
    severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
    status: OPERATIONAL_ERROR_STATUS.OPEN,
    message: "사용자 알림 생성 중 데이터베이스 저장에 실패했습니다.",
    user_id: users.userOne,
    actor_user_id: null,
    fingerprint:
      "seed:notifications:create_user_notification:in_app_notification_create:NOTIFICATION_CREATE_FAILED",
    occurrence_count: 3,
    first_seen_at: "2026-07-21T01:10:00.000Z",
    last_seen_at: "2026-07-28T04:20:00.000Z",
    context: {
      notificationType: "REVIEW_REMINDER",
      noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      reviewLogId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: "2026-07-21T01:10:00.000Z",
    updated_at: "2026-07-28T04:20:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    operation: NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
    stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.PUSH_SEND,
    error_code: NOTIFICATION_OPERATIONAL_ERROR_CODES.PUSH_SUBSCRIPTION_GONE,
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    status: OPERATIONAL_ERROR_STATUS.OPEN,
    message: "만료된 Push 구독으로 알림 전송에 실패했습니다.",
    user_id: users.userTwo,
    actor_user_id: null,
    fingerprint:
      "seed:notifications:dispatch_push:push_send:PUSH_SUBSCRIPTION_GONE",
    occurrence_count: 7,
    first_seen_at: "2026-07-22T08:30:00.000Z",
    last_seen_at: "2026-07-28T02:15:00.000Z",
    context: {
      notificationType: "REVIEW_REMINDER",
      providerStatusCode: 410,
      retryable: false,
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: "2026-07-22T08:30:00.000Z",
    updated_at: "2026-07-28T02:15:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3",
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    operation: NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
    stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.PUSH_SUBSCRIPTION_CLEANUP,
    error_code:
      NOTIFICATION_OPERATIONAL_ERROR_CODES.PUSH_SUBSCRIPTION_DELETE_FAILED,
    severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
    status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    message: "만료된 Push 구독 정리 중 Storage 삭제에 실패했습니다.",
    user_id: users.userOne,
    actor_user_id: null,
    fingerprint:
      "seed:notifications:dispatch_push:push_subscription_cleanup:PUSH_SUBSCRIPTION_DELETE_FAILED",
    occurrence_count: 2,
    first_seen_at: "2026-07-18T00:05:00.000Z",
    last_seen_at: "2026-07-23T00:05:00.000Z",
    context: {
      endpointHash: "subscription-endpoint-hash",
      providerStatusCode: 410,
      retryable: false,
    },
    resolved_at: "2026-07-24T06:40:00.000Z",
    resolved_by: users.admin,
    resolution_note: "구독 정리 재시도 배치에서 삭제를 완료했습니다.",
    created_at: "2026-07-18T00:05:00.000Z",
    updated_at: "2026-07-24T06:40:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4",
    feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
    operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
    stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    error_code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
    severity: OPERATIONAL_ERROR_SEVERITY.INFO,
    status: OPERATIONAL_ERROR_STATUS.IGNORED,
    message: "운영 오류 목록 조회 중 일시적인 네트워크 오류가 발생했습니다.",
    user_id: null,
    actor_user_id: users.admin,
    fingerprint:
      "seed:admin_operational_errors:list_operational_errors:list_query:OPERATIONAL_ERROR_LIST_FAILED",
    occurrence_count: 1,
    first_seen_at: "2026-07-19T14:05:00.000Z",
    last_seen_at: "2026-07-19T14:05:00.000Z",
    context: {
      page: 1,
      pageSize: 10,
      sortField: "lastSeenAt",
    },
    resolved_at: "2026-07-20T02:00:00.000Z",
    resolved_by: users.admin,
    resolution_note:
      "로컬 네트워크 단절로 인한 일회성 오류로 판단해 무시했습니다.",
    created_at: "2026-07-19T14:05:00.000Z",
    updated_at: "2026-07-20T02:00:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
    operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.GET_OPERATIONAL_ERROR_DETAIL,
    stage: ADMIN_OPERATIONAL_ERROR_STAGES.PROFILE_QUERY,
    error_code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_PROFILES_FAILED,
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    status: OPERATIONAL_ERROR_STATUS.OPEN,
    message: "운영 오류 상세 화면에서 관련 사용자 정보를 불러오지 못했습니다.",
    user_id: users.userTwo,
    actor_user_id: users.admin,
    fingerprint:
      "seed:admin_operational_errors:get_operational_error_detail:profile_query:OPERATIONAL_ERROR_PROFILES_FAILED",
    occurrence_count: 4,
    first_seen_at: "2026-07-16T04:55:00.000Z",
    last_seen_at: "2026-07-27T09:12:00.000Z",
    context: {
      operationalErrorId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
      profileCount: 2,
      profileIds: [users.userTwo, users.admin],
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: "2026-07-16T04:55:00.000Z",
    updated_at: "2026-07-27T09:12:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6",
    feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
    operation:
      ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
    stage: ADMIN_OPERATIONAL_ERROR_STAGES.STATUS_HISTORY_INSERT,
    error_code:
      ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_HISTORY_INSERT_FAILED,
    severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
    status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    message: "운영 오류 상태 변경 후 처리 이력 저장에 실패했습니다.",
    user_id: null,
    actor_user_id: users.admin,
    fingerprint:
      "seed:admin_operational_errors:update_operational_error_status:status_history_insert:OPERATIONAL_ERROR_HISTORY_INSERT_FAILED",
    occurrence_count: 1,
    first_seen_at: "2026-07-26T11:30:00.000Z",
    last_seen_at: "2026-07-26T11:30:00.000Z",
    context: {
      fromStatus: OPERATIONAL_ERROR_STATUS.OPEN,
      hasNote: true,
      operationalErrorId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
      toStatus: OPERATIONAL_ERROR_STATUS.RESOLVED,
    },
    resolved_at: "2026-07-27T03:15:00.000Z",
    resolved_by: users.admin,
    resolution_note: "상태 변경과 이력 저장 경로를 재검증했습니다.",
    created_at: "2026-07-26T11:30:00.000Z",
    updated_at: "2026-07-27T03:15:00.000Z",
  },
];

const statusHistory = [
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    operational_error_id: operationalErrors[2].id,
    from_status: null,
    to_status: OPERATIONAL_ERROR_STATUS.OPEN,
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-18T00:05:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
    operational_error_id: operationalErrors[2].id,
    from_status: OPERATIONAL_ERROR_STATUS.OPEN,
    to_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    note: "구독 정리 재시도 배치에서 삭제 완료",
    changed_by: users.admin,
    created_at: "2026-07-24T06:40:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
    operational_error_id: operationalErrors[3].id,
    from_status: null,
    to_status: OPERATIONAL_ERROR_STATUS.OPEN,
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-19T14:05:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    operational_error_id: operationalErrors[3].id,
    from_status: OPERATIONAL_ERROR_STATUS.OPEN,
    to_status: OPERATIONAL_ERROR_STATUS.IGNORED,
    note: "일회성 네트워크 오류로 판단하여 제외",
    changed_by: users.admin,
    created_at: "2026-07-20T02:00:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd5",
    operational_error_id: operationalErrors[5].id,
    from_status: null,
    to_status: OPERATIONAL_ERROR_STATUS.OPEN,
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-26T11:30:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd6",
    operational_error_id: operationalErrors[5].id,
    from_status: OPERATIONAL_ERROR_STATUS.OPEN,
    to_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    note: "상태 변경과 이력 저장 경로 재검증 완료",
    changed_by: users.admin,
    created_at: "2026-07-27T03:15:00.000Z",
  },
];

/**
 * Supabase 요청 결과에 오류가 있으면 예외를 발생시킵니다.
 *
 * @param {string} label 오류 메시지에 표시할 작업 이름
 * @param {{ data: unknown; error: { message: string } | null }} response
 * @returns {Promise<unknown>} 요청 결과 데이터
 */
async function assertOk(label, response) {
  if (response.error) {
    throw new Error(`${label}: ${response.error.message}`);
  }

  return response.data;
}

/**
 * 피드백 seed에서 생성하는 사용자가 존재하는지 확인합니다.
 */
async function verifySeedUsers() {
  for (const userId of Object.values(users)) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      throw new Error(
        [
          `Required local user does not exist: ${userId}`,
          "Run the feedback seed first:",
          "node .\\scripts\\seed-local-feedbacks.mjs",
        ].join("\n"),
      );
    }
  }
}

/**
 * 고정 UUID에 해당하는 기존 운영 오류를 지운 후 다시 생성합니다.
 *
 * 운영 오류 삭제 시 상태 이력도 ON DELETE CASCADE로 함께 제거됩니다.
 */
async function seedOperationalErrors() {
  await assertOk(
    "delete existing operational errors",
    await supabase
      .from("operational_errors")
      .delete()
      .in(
        "id",
        operationalErrors.map((error) => error.id),
      ),
  );

  await assertOk(
    "insert operational errors",
    await supabase.from("operational_errors").insert(operationalErrors),
  );

  await assertOk(
    "insert operational error status history",
    await supabase
      .from("operational_error_status_history")
      .insert(statusHistory),
  );
}

/**
 * 생성된 운영 오류와 상태 이력을 확인합니다.
 */
async function verify() {
  const seededErrors = await assertOk(
    "verify operational errors",
    await supabase
      .from("operational_errors")
      .select("id, status")
      .in(
        "id",
        operationalErrors.map((error) => error.id),
      ),
  );

  const seededHistory = await assertOk(
    "verify operational error status history",
    await supabase
      .from("operational_error_status_history")
      .select("id")
      .in(
        "id",
        statusHistory.map((history) => history.id),
      ),
  );

  const statusCounts = seededErrors.reduce((counts, error) => {
    counts[error.status] = (counts[error.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    operationalErrorCount: seededErrors.length,
    statusHistoryCount: seededHistory.length,
    statusCounts,
  };
}

/**
 * 로컬 관리자 운영 오류 화면 테스트 데이터를 생성합니다.
 */
async function main() {
  await verifySeedUsers();
  await seedOperationalErrors();

  const result = await verify();

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
