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

const operationalErrors = [
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    feature: "feedback",
    operation: "create_feedback",
    stage: "insert_feedback",
    error_code: "FEEDBACK_INSERT_FAILED",
    severity: "ERROR",
    status: "OPEN",
    message: "피드백 등록 중 데이터베이스 저장에 실패했습니다.",
    user_id: users.userOne,
    actor_user_id: users.userOne,
    fingerprint:
      "feedback:create_feedback:insert_feedback:FEEDBACK_INSERT_FAILED:user-one",
    occurrence_count: 3,
    first_seen_at: "2026-07-21T01:10:00.000Z",
    last_seen_at: "2026-07-28T04:20:00.000Z",
    context: {
      category: "BUG",
      route: "/feedback",
      noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: "2026-07-21T01:10:00.000Z",
    updated_at: "2026-07-28T04:20:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
    feature: "notifications",
    operation: "send_push_notification",
    stage: "web_push_send",
    error_code: "PUSH_SUBSCRIPTION_EXPIRED",
    severity: "WARN",
    status: "OPEN",
    message: "만료된 Push 구독으로 알림 전송에 실패했습니다.",
    user_id: users.userTwo,
    actor_user_id: null,
    fingerprint:
      "notifications:send_push_notification:web_push_send:PUSH_SUBSCRIPTION_EXPIRED:user-two",
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
    feature: "review",
    operation: "complete_review",
    stage: "calculate_next_review",
    error_code: "NEXT_REVIEW_CALCULATION_FAILED",
    severity: "ERROR",
    status: "RESOLVED",
    message: "다음 복습일 계산 중 예상하지 못한 오류가 발생했습니다.",
    user_id: users.userOne,
    actor_user_id: users.userOne,
    fingerprint:
      "review:complete_review:calculate_next_review:NEXT_REVIEW_CALCULATION_FAILED:note-one",
    occurrence_count: 2,
    first_seen_at: "2026-07-18T00:05:00.000Z",
    last_seen_at: "2026-07-23T00:05:00.000Z",
    context: {
      noteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      reviewRound: 2,
      timezone: "Asia/Seoul",
    },
    resolved_at: "2026-07-24T06:40:00.000Z",
    resolved_by: users.admin,
    resolution_note:
      "KST 자정 변환 로직을 수정하고 재현 테스트를 완료했습니다.",
    created_at: "2026-07-18T00:05:00.000Z",
    updated_at: "2026-07-24T06:40:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4",
    feature: "auth",
    operation: "sign_out",
    stage: "revoke_session",
    error_code: "SESSION_REVOCATION_DELAYED",
    severity: "INFO",
    status: "IGNORED",
    message: "로그아웃 직후 세션 캐시가 잠시 유지되었습니다.",
    user_id: users.userTwo,
    actor_user_id: users.userTwo,
    fingerprint:
      "auth:sign_out:revoke_session:SESSION_REVOCATION_DELAYED:user-two",
    occurrence_count: 1,
    first_seen_at: "2026-07-19T14:05:00.000Z",
    last_seen_at: "2026-07-19T14:05:00.000Z",
    context: {
      route: "/notes",
      browserAction: "back",
      durationMs: 180,
    },
    resolved_at: null,
    resolved_by: users.admin,
    resolution_note:
      "브라우저 캐시의 일시적인 표시로 판단하여 추적 대상에서 제외했습니다.",
    created_at: "2026-07-19T14:05:00.000Z",
    updated_at: "2026-07-20T02:00:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    feature: "storage",
    operation: "upload_feedback_image",
    stage: "validate_file",
    error_code: "IMAGE_FILE_TOO_LARGE",
    severity: "WARN",
    status: "OPEN",
    message: "허용된 최대 크기를 초과한 이미지 업로드가 거부되었습니다.",
    user_id: users.userTwo,
    actor_user_id: users.userTwo,
    fingerprint:
      "storage:upload_feedback_image:validate_file:IMAGE_FILE_TOO_LARGE:user-two",
    occurrence_count: 4,
    first_seen_at: "2026-07-16T04:55:00.000Z",
    last_seen_at: "2026-07-27T09:12:00.000Z",
    context: {
      bucket: "feedbacks",
      fileName: "large-screenshot.png",
      fileSize: 7340032,
      maxFileSize: 5242880,
    },
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    created_at: "2026-07-16T04:55:00.000Z",
    updated_at: "2026-07-27T09:12:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6",
    feature: "admin_feedback",
    operation: "delete_feedback_reply",
    stage: "delete_notification",
    error_code: "FEEDBACK_REPLY_NOTIFICATION_DELETE_FAILED",
    severity: "ERROR",
    status: "RESOLVED",
    message: "피드백 답변 삭제 후 연결된 알림 삭제에 실패했습니다.",
    user_id: users.userOne,
    actor_user_id: users.admin,
    fingerprint:
      "admin_feedback:delete_feedback_reply:delete_notification:FEEDBACK_REPLY_NOTIFICATION_DELETE_FAILED",
    occurrence_count: 1,
    first_seen_at: "2026-07-26T11:30:00.000Z",
    last_seen_at: "2026-07-26T11:30:00.000Z",
    context: {
      feedbackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      notificationType: "FEEDBACK_REPLY",
      transactionName: "delete_feedback_reply_with_notifications",
    },
    resolved_at: "2026-07-27T03:15:00.000Z",
    resolved_by: users.admin,
    resolution_note: "답변과 알림을 함께 삭제하는 RPC로 변경했습니다.",
    created_at: "2026-07-26T11:30:00.000Z",
    updated_at: "2026-07-27T03:15:00.000Z",
  },
];

const statusHistory = [
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    operational_error_id: operationalErrors[2].id,
    from_status: null,
    to_status: "OPEN",
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-18T00:05:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
    operational_error_id: operationalErrors[2].id,
    from_status: "OPEN",
    to_status: "RESOLVED",
    note: "KST 자정 변환 로직 수정 및 재현 테스트 완료",
    changed_by: users.admin,
    created_at: "2026-07-24T06:40:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
    operational_error_id: operationalErrors[3].id,
    from_status: null,
    to_status: "OPEN",
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-19T14:05:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    operational_error_id: operationalErrors[3].id,
    from_status: "OPEN",
    to_status: "IGNORED",
    note: "브라우저 캐시의 일시적인 표시로 판단하여 제외",
    changed_by: users.admin,
    created_at: "2026-07-20T02:00:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd5",
    operational_error_id: operationalErrors[5].id,
    from_status: null,
    to_status: "OPEN",
    note: "운영 오류 최초 등록",
    changed_by: null,
    created_at: "2026-07-26T11:30:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd6",
    operational_error_id: operationalErrors[5].id,
    from_status: "OPEN",
    to_status: "RESOLVED",
    note: "답변과 알림 삭제를 하나의 RPC 트랜잭션으로 변경",
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
