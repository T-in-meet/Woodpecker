import { useMutation, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateAdminAiQueriesMock, queryClientMock } = vi.hoisted(() => ({
  invalidateAdminAiQueriesMock: vi.fn().mockResolvedValue(undefined),
  queryClientMock: {},
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(
    (options: AdminAiSettingConfigurationMutationOptions) => options,
  ),
  useQueryClient: vi.fn(() => queryClientMock),
}));

vi.mock("../actions", () => ({
  saveAdminAiSettingConfigurationsAction: vi.fn(),
}));

vi.mock("../../utils/invalidate-admin-ai-queries", () => ({
  invalidateAdminAiQueries: invalidateAdminAiQueriesMock,
}));

import { useSaveAdminAiSettingConfigurations } from "../hooks/use-admin-ai-setting-configuration-mutations";

const SETTING_ID = "22222222-2222-4222-8222-222222222222";

/** Configuration 저장 mutation 성공/실패 결과의 최소 구조입니다. */
type AdminAiSettingConfigurationMutationResult =
  | {
      success: true;
    }
  | {
      message: string;
      success: false;
    };

/** Configuration 저장 mutation 변수의 최소 구조입니다. */
type AdminAiSettingConfigurationMutationVariables = {
  /** 저장할 AI 설정 구성 목록입니다. */
  configurations: [];

  /** AI 설정 ID입니다. */
  settingId: string;
};

/** 테스트에서 검증하는 Configuration 저장 mutation 옵션입니다. */
type AdminAiSettingConfigurationMutationOptions = {
  /** 서버 action mutation 함수입니다. */
  mutationFn: unknown;

  /** mutation 성공 콜백입니다. */
  onSuccess: (
    result: AdminAiSettingConfigurationMutationResult,
    variables: AdminAiSettingConfigurationMutationVariables,
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

  return latestCall[0] as AdminAiSettingConfigurationMutationOptions;
}

describe("useSaveAdminAiSettingConfigurations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 구성 저장이 성공 응답으로 resolve되면 관리자 AI Query 캐시를 무효화한다", async () => {
    const queryClient = useQueryClient();

    useSaveAdminAiSettingConfigurations();

    await getLatestUseMutationOptions().onSuccess(
      {
        success: true,
      },
      {
        configurations: [],
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });

  it("AI 구성 저장이 실패 응답으로 resolve되면 Query 캐시를 무효화하지 않는다", async () => {
    useSaveAdminAiSettingConfigurations();

    await getLatestUseMutationOptions().onSuccess(
      {
        message: "AI 구성 저장에 실패했습니다.",
        success: false,
      },
      {
        configurations: [],
        settingId: SETTING_ID,
      },
    );

    expect(invalidateAdminAiQueriesMock).not.toHaveBeenCalled();
  });
});
