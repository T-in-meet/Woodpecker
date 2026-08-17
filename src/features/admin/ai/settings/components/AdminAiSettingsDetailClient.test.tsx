import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiSetting } from "../types";
import { AdminAiSettingsDetailClient } from "./AdminAiSettingsDetailClient";

const useAdminAiSettingDetailMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/features/admin/components/layout/AdminBreadcrumbDynamicItems",
  () => ({
    AdminBreadcrumbDynamicItems: () => <nav aria-label="breadcrumb" />,
  }),
);

vi.mock("@/features/admin/components/layout/AdminDetailPageHeader", () => ({
  AdminDetailPageHeader: ({
    title,
  }: {
    /** 헤더 제목입니다. */
    title: string;
  }) => <header>{title}</header>,
}));

vi.mock("../hooks/use-admin-ai-setting-queries", () => ({
  useAdminAiSettingDetail: useAdminAiSettingDetailMock,
}));

vi.mock("./AdminAiSettingConfigurationForm", () => ({
  AdminAiSettingConfigurationForm: () => (
    <form aria-label="setting configuration form" />
  ),
}));

vi.mock("./AdminAiSettingInfoSection", () => ({
  AdminAiSettingInfoSection: ({ children }: { children?: ReactNode }) => (
    <section aria-label="setting info">{children}</section>
  ),
}));

/** useAdminAiSettingDetail 테스트 double이 반환하는 최소 Query 결과입니다. */
type AdminAiSettingDetailQueryState = {
  /** 조회된 AI 설정 상세 데이터입니다. */
  data?: AdminAiSetting | null;

  /** 조회 오류입니다. */
  error: Error | null;

  /** 최초 조회 대기 상태입니다. */
  isPending: boolean;

  /** 상세 Query를 수동으로 다시 실행하는 함수입니다. */
  refetch: () => Promise<unknown>;
};

/**
 * 상세 Query 훅 mock의 다음 반환값을 설정합니다.
 *
 * @param state 테스트에 사용할 Query 상태
 */
function mockDetailQueryState(state: AdminAiSettingDetailQueryState) {
  useAdminAiSettingDetailMock.mockReturnValue(state);
}

describe("AdminAiSettingsDetailClient", () => {
  beforeEach(() => {
    useAdminAiSettingDetailMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({ data: undefined });
  });

  it("상세 조회 오류 상태에서 다시 시도 버튼을 누르면 AI 설정 상세 Query를 다시 실행한다", async () => {
    const user = userEvent.setup();

    mockDetailQueryState({
      error: new Error("setting detail failed"),
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingsDetailClient settingId="11111111-1111-4111-8111-111111111111" />,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
