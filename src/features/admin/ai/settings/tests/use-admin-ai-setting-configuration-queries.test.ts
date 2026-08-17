import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminAiSettingConfigurationsMock } = vi.hoisted(() => ({
  getAdminAiSettingConfigurationsMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(
    (options: AdminAiSettingConfigurationQueryOptions) => options,
  ),
}));

vi.mock("../queries", () => ({
  getAdminAiSettingConfigurations: getAdminAiSettingConfigurationsMock,
}));

import { useAdminAiSettingConfigurations } from "../hooks/use-admin-ai-setting-configuration-queries";

/** 테스트에서 검증하는 React Query 옵션의 최소 구조입니다. */
type AdminAiSettingConfigurationQueryOptions = {
  /** Query 활성화 조건입니다. */
  enabled?: boolean;

  /** Query 실행 함수입니다. */
  queryFn: () => unknown;

  /** Query key입니다. */
  queryKey: readonly unknown[];

  /** React Query 자동 재시도 설정입니다. */
  retry?: boolean;
};

/**
 * 가장 최근 useQuery 호출 옵션을 반환합니다.
 *
 * @returns React Query 호출 옵션
 */
function getLatestUseQueryOptions() {
  const calls = vi.mocked(useQuery).mock.calls;
  const latestCall = calls.at(-1);

  if (!latestCall) {
    throw new Error("useQuery was not called.");
  }

  return latestCall[0] as AdminAiSettingConfigurationQueryOptions;
}

describe("use-admin-ai-setting-configuration-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 설정 구성 조회는 enabled 조건을 유지하고 retry를 끈다", () => {
    const settingId = "11111111-1111-4111-8111-111111111111";

    useAdminAiSettingConfigurations(settingId);

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(true);
    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiSettingConfigurationsMock).toHaveBeenCalledWith(settingId);
  });

  it("AI 설정 구성 조회는 빈 Setting ID에서 비활성화하고 retry를 끈다", () => {
    useAdminAiSettingConfigurations("");

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(false);
    expect(options.retry).toBe(false);
  });
});
