import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAiSettingConfigurationForm } from "./AdminAiSettingConfigurationForm";

const useAdminAiSettingConfigurationsMock = vi.hoisted(() => vi.fn());
const useSaveAdminAiSettingConfigurationsMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin/components/common/AdminAlertDialog", () => ({
  AdminAlertDialog: () => null,
}));

vi.mock("../hooks/use-admin-ai-setting-configuration-queries", () => ({
  useAdminAiSettingConfigurations: useAdminAiSettingConfigurationsMock,
}));

vi.mock("../hooks/use-admin-ai-setting-configuration-mutations", () => ({
  useSaveAdminAiSettingConfigurations: useSaveAdminAiSettingConfigurationsMock,
}));

vi.mock("./AdminAiSettingConfigurationsSection", () => ({
  AdminAiSettingConfigurationsSection: ({
    children,
  }: {
    /** 섹션 내부에 렌더링할 테스트용 콘텐츠입니다. */
    children?: ReactNode;
  }) => <section aria-label="setting configurations">{children}</section>,
}));

/** useAdminAiSettingConfigurations 테스트 double이 반환하는 최소 Query 결과입니다. */
type AdminAiSettingConfigurationsQueryState = {
  /** 조회된 AI 설정 구성 목록입니다. */
  data?: unknown[];

  /** 조회 오류입니다. */
  error: Error | null;

  /** 최초 조회 대기 상태입니다. */
  isPending: boolean;

  /** 구성 Query를 수동으로 다시 실행하는 함수입니다. */
  refetch: () => Promise<unknown>;
};

/**
 * 구성 Query 훅 mock의 다음 반환값을 설정합니다.
 *
 * @param state 테스트에 사용할 Query 상태
 */
function mockConfigurationsQueryState(
  state: AdminAiSettingConfigurationsQueryState,
) {
  useAdminAiSettingConfigurationsMock.mockReturnValue(state);
}

describe("AdminAiSettingConfigurationForm", () => {
  beforeEach(() => {
    useAdminAiSettingConfigurationsMock.mockReset();
    useSaveAdminAiSettingConfigurationsMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({ data: undefined });
    useSaveAdminAiSettingConfigurationsMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });
  });

  it("구성 조회 오류 상태에서 다시 시도 버튼을 누르면 AI 설정 구성 Query를 다시 실행한다", async () => {
    const user = userEvent.setup();

    mockConfigurationsQueryState({
      error: new Error("setting configurations failed"),
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingConfigurationForm settingId="11111111-1111-4111-8111-111111111111" />,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
