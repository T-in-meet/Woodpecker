import { describe, expect, it } from "vitest";

import type { AdminUserListRow } from "../utils/user-query-mapper";
import { mapUserRows } from "../utils/user-query-mapper";

/**
 * 관리자 사용자 목록 mapper 테스트에서 사용하는 기본 View row입니다.
 */
const BASE_ROW = {
  agreement_status: "COMPLETED",
  avatar_url: "https://example.com/avatar.png",
  canonical_email: "user@example.com",
  created_at: "2026-07-31T00:00:00.000Z",
  id: "user-id",
  nickname: "사용자",
  role: "USER",
  signup_method: "EMAIL",
} satisfies AdminUserListRow;

describe("mapUserRows", () => {
  it("admin_user_list View row를 사용자 목록 item으로 변환합니다.", () => {
    const result = mapUserRows([BASE_ROW]);

    expect(result).toEqual([
      {
        agreementStatus: "COMPLETED",
        avatarUrl: "https://example.com/avatar.png",
        createdAt: "2026-07-31T00:00:00.000Z",
        email: "user@example.com",
        id: "user-id",
        nickname: "사용자",
        role: "USER",
        signupMethod: "EMAIL",
      },
    ]);
  });

  it("legacy row의 canonical_email이 없으면 null 이메일로 변환합니다.", () => {
    const result = mapUserRows([
      {
        ...BASE_ROW,
        canonical_email: null,
      },
    ]);

    expect(result[0]?.email).toBeNull();
  });

  it("약관 동의 row가 없어 signup_method가 없으면 알 수 없음으로 변환합니다.", () => {
    const result = mapUserRows([
      {
        ...BASE_ROW,
        signup_method: null,
      },
    ]);

    expect(result[0]?.signupMethod).toBe("UNKNOWN");
  });

  it("목록 표시에 반드시 필요한 값이 없으면 예외를 발생시킵니다.", () => {
    expect(() =>
      mapUserRows([
        {
          ...BASE_ROW,
          id: null,
        },
      ]),
    ).toThrow("Admin user list row contains missing required values.");
  });
});
