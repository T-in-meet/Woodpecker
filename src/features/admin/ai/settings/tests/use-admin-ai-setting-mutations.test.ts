import { useMutation, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateAdminAiQueriesMock, queryClientMock } = vi.hoisted(() => ({
  invalidateAdminAiQueriesMock: vi.fn().mockResolvedValue(undefined),
  queryClientMock: {},
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: AdminAiSettingMutationOptions) => options),
  useQueryClient: vi.fn(() => queryClientMock),
}));

vi.mock("../actions", () => ({
  createAdminAiSettingAction: vi.fn(),
  deleteAdminAiSettingAction: vi.fn(),
  updateAdminAiSettingAction: vi.fn(),
}));

vi.mock("../../utils/invalidate-admin-ai-queries", () => ({
  invalidateAdminAiQueries: invalidateAdminAiQueriesMock,
}));

import {
  useCreateAdminAiSetting,
  useDeleteAdminAiSetting,
  useUpdateAdminAiSetting,
} from "../hooks/use-admin-ai-setting-mutations";

const SETTING_ID = "22222222-2222-4222-8222-222222222222";

/**
 * 테스트에서 검증하는 Settings mutation 성공/실패 결과의 최소 구조입니다.
 */
type AdminAiSettingMutationResult =
  | {
      success: true;
      settingId?: string;
    }
  | {
      success: false;
      message: string;
    };

/**
 * Settings mutation invalidation에서 사용하는 변수의 최소 구조입니다.
 */
type AdminAiSettingMutationVariables = {
  settingId: string;
};

/**
 * 테스트에서 검증하는 Settings mutation 옵션의 최소 구조입니다.
 */
type AdminAiSettingMutationOptions = {
  mutationFn: unknown;
  onSuccess: (
    result: AdminAiSettingMutationResult,
    variables: AdminAiSettingMutationVariables,
  ) => unknown;
};

/**
 * 가장 최근 useMutation 호출 옵션을 반환합니다.
 *
 * @returns React Query mutation 호출 옵션
 */
function getLatestUseMutationOptions() {
  const calls = vi.mocked(useMutation).mock.calls;
  const latestCall = calls.at(-1);

  if (!latestCall) {
    throw new Error("useMutation was not called.");
  }

  return latestCall[0] as AdminAiSettingMutationOptions;
}

describe("use-admin-ai-setting-mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 설정 생성이 성공 응답으로 resolve되면 Settings Query 캐시를 무효화한다", async () => {
    const queryClient = useQueryClient();

    useCreateAdminAiSetting();

    await getLatestUseMutationOptions().onSuccess(
      {
        success: true,
        settingId: SETTING_ID,
      },
      {
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });

  it("AI 설정 수정이 성공 응답으로 resolve되면 관리자 AI Query 캐시를 무효화한다", async () => {
    const queryClient = useQueryClient();

    useUpdateAdminAiSetting();

    await getLatestUseMutationOptions().onSuccess(
      {
        success: true,
      },
      {
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });

  it("AI 설정 삭제가 실패 응답으로 resolve되면 Query 캐시를 무효화하지 않는다", async () => {
    useDeleteAdminAiSetting();

    await getLatestUseMutationOptions().onSuccess(
      {
        success: false,
        message: "AI 설정을 찾을 수 없습니다.",
      },
      {
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).not.toHaveBeenCalled();
  });

  it("AI 설정 삭제가 성공 응답으로 resolve되면 관리자 AI Query 캐시를 무효화한다", async () => {
    const queryClient = useQueryClient();

    useDeleteAdminAiSetting();

    await getLatestUseMutationOptions().onSuccess(
      {
        success: true,
      },
      {
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });
});
