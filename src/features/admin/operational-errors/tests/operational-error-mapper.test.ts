import { describe, expect, it } from "vitest";

import type {
  OperationalErrorRow,
  OperationalErrorStatusHistoryRow,
} from "../types/operational-error-query";
import {
  mapHistoryRow,
  mapOperationalErrorRow,
} from "../utils/operational-error-mapper";

const operationalErrorRow: OperationalErrorRow = {
  actor_user_id: "actor-user-id",
  context: {
    route: "/api/example",
  },
  created_at: "2026-07-28T01:00:00.000Z",
  error_code: "UNEXPECTED_ERROR",
  feature: "feedback",
  fingerprint: "fingerprint-value",
  first_seen_at: "2026-07-27T01:00:00.000Z",
  id: "error-id",
  last_seen_at: "2026-07-28T02:00:00.000Z",
  message: "예상하지 못한 오류가 발생했습니다.",
  occurrence_count: 3,
  operation: "createFeedback",
  resolution_note: null,
  resolved_at: null,
  resolved_by: null,
  severity: "ERROR",
  stage: "SERVER_ACTION",
  status: "OPEN",
  updated_at: "2026-07-28T02:00:00.000Z",
  user_id: "user-id",
};

describe("mapOperationalErrorRow", () => {
  it("운영 오류 DB 행을 목록 화면 데이터로 변환한다", () => {
    expect(mapOperationalErrorRow(operationalErrorRow)).toEqual({
      context: {
        route: "/api/example",
      },
      createdAt: "2026-07-28T01:00:00.000Z",
      errorCode: "UNEXPECTED_ERROR",
      feature: "feedback",
      fingerprint: "fingerprint-value",
      id: "error-id",
      lastSeenAt: "2026-07-28T02:00:00.000Z",
      message: "예상하지 못한 오류가 발생했습니다.",
      occurrenceCount: 3,
      operation: "createFeedback",
      severity: "ERROR",
      stage: "SERVER_ACTION",
      status: "OPEN",
      userId: "user-id",
    });
  });

  it("사용자 ID가 없는 운영 오류를 null로 유지한다", () => {
    const row: OperationalErrorRow = {
      ...operationalErrorRow,
      user_id: null,
    };

    expect(mapOperationalErrorRow(row).userId).toBeNull();
  });
});

describe("mapHistoryRow", () => {
  const historyRow: OperationalErrorStatusHistoryRow = {
    changed_by: "admin-user-id",
    created_at: "2026-07-28T03:00:00.000Z",
    from_status: "OPEN",
    id: "history-id",
    note: "배포 후 정상화 확인",
    to_status: "RESOLVED",
  };

  it("프로필 닉네임이 있으면 변경자 표시 이름으로 사용한다", () => {
    const profileLabels = new Map([["admin-user-id", "관리자"]]);

    expect(mapHistoryRow(historyRow, profileLabels)).toEqual({
      changedBy: "admin-user-id",
      changedByLabel: "관리자",
      createdAt: "2026-07-28T03:00:00.000Z",
      fromStatus: "OPEN",
      id: "history-id",
      note: "배포 후 정상화 확인",
      toStatus: "RESOLVED",
    });
  });

  it("프로필 닉네임이 없으면 변경자 ID를 표시 이름으로 사용한다", () => {
    const result = mapHistoryRow(historyRow, new Map());

    expect(result.changedBy).toBe("admin-user-id");
    expect(result.changedByLabel).toBe("admin-user-id");
  });

  it("변경자가 없으면 변경자와 표시 이름을 null로 반환한다", () => {
    const row: OperationalErrorStatusHistoryRow = {
      ...historyRow,
      changed_by: null,
    };

    const result = mapHistoryRow(row, new Map());

    expect(result.changedBy).toBeNull();
    expect(result.changedByLabel).toBeNull();
  });
});
