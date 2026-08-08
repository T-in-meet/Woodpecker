import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_OPERATIONAL_ERROR_CODES,
  ADMIN_OPERATIONAL_ERROR_FEATURES,
  ADMIN_OPERATIONAL_ERROR_OPERATIONS,
  ADMIN_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import { getOperationalErrorContext } from "@/features/operational-errors/utils/get-operational-error-context";

import { recordAdminOperationalError } from "../utils/record-admin-operational-error";

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: vi.fn(),
}));

vi.mock(
  "@/features/operational-errors/utils/get-operational-error-context",
  () => ({
    getOperationalErrorContext: vi.fn(),
  }),
);

const ACTOR_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const mockedReportOperationalError = vi.mocked(reportOperationalError);
const mockedGetOperationalErrorContext = vi.mocked(getOperationalErrorContext);

describe("recordAdminOperationalError", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedReportOperationalError.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ok: true,
      recorded: "created",
    });

    mockedGetOperationalErrorContext.mockReturnValue({
      code: "42703",
      message: "column does not exist",
    });
  });

  it("관리자 운영 오류 정보를 공통 보고 함수에 전달한다", async () => {
    const error = {
      code: "42703",
      message: "column does not exist",
    };

    await recordAdminOperationalError({
      actorUserId: ACTOR_USER_ID,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
      error,
      message: "운영 오류 목록을 불러오지 못했습니다.",
      operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    });

    expect(mockedGetOperationalErrorContext).toHaveBeenCalledOnce();
    expect(mockedGetOperationalErrorContext).toHaveBeenCalledWith(
      error,
      "Unknown admin operational error",
    );

    expect(mockedReportOperationalError).toHaveBeenCalledOnce();
    expect(mockedReportOperationalError).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      context: {
        error: {
          code: "42703",
          message: "column does not exist",
        },
      },
      errorCode: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
      feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
      message: "운영 오류 목록을 불러오지 못했습니다.",
      operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    });
  });

  it("기능별 context와 변환된 오류 정보를 함께 전달한다", async () => {
    const error = new Error("목록 조회 실패");

    await recordAdminOperationalError({
      actorUserId: ACTOR_USER_ID,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
      context: {
        page: 2,
        pageSize: 20,
        searchField: "message",
        sortDirection: "desc",
        sortField: "lastSeenAt",
      },
      error,
      message: "운영 오류 목록을 불러오지 못했습니다.",
      operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    });

    expect(mockedReportOperationalError).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      context: {
        error: {
          code: "42703",
          message: "column does not exist",
        },
        page: 2,
        pageSize: 20,
        searchField: "message",
        sortDirection: "desc",
        sortField: "lastSeenAt",
      },
      errorCode: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_LIST_FAILED,
      feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
      message: "운영 오류 목록을 불러오지 못했습니다.",
      operation: ADMIN_OPERATIONAL_ERROR_OPERATIONS.LIST_OPERATIONAL_ERRORS,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.LIST_QUERY,
    });
  });

  it("관리자 ID를 공통 보고 함수에 전달한다", async () => {
    await recordAdminOperationalError({
      actorUserId: ACTOR_USER_ID,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_STATUS_UPDATE_FAILED,
      error: new Error("상태 변경 실패"),
      message: "운영 오류 상태를 변경하지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.STATUS_UPDATE,
    });

    expect(mockedReportOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_USER_ID,
      }),
    );
  });
});
