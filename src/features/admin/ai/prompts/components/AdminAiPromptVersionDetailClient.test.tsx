import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiPromptVersionRow } from "../../types";
import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptVersionDetailClient } from "./AdminAiPromptVersionDetailClient";

const routerPushMock = vi.hoisted(() => vi.fn());
const useAdminAiPromptVersionDetailMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

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
    /** 헤더 제목입니다. */ title: string;
  }) => <header>{title}</header>,
}));

vi.mock("../hooks/use-admin-ai-prompt-queries", () => ({
  useAdminAiPromptVersionDetail: useAdminAiPromptVersionDetailMock,
}));

vi.mock("../hooks/use-admin-ai-prompt-version-lifecycle-actions", () => ({
  useAdminAiPromptVersionLifecycleActions: () => ({
    deletePending: false,
    handleArchiveVersion: vi.fn(),
    handleDeleteVersion: vi.fn(),
    handlePublishVersion: vi.fn(),
    message: null,
    pending: false,
  }),
}));

vi.mock("./AdminAiPromptVersionDetailSkeleton", () => ({
  AdminAiPromptVersionDetailSkeleton: () => <div>상세 로딩 중</div>,
}));

vi.mock("./AdminAiPromptVersionForm", () => ({
  AdminAiPromptVersionForm: () => <form aria-label="prompt version form" />,
}));

vi.mock("./AdminAiPromptVersionLifecycleSelect", () => ({
  AdminAiPromptVersionLifecycleSelect: () => <div>lifecycle select</div>,
}));

/** Prompt Version 상세 Query가 반환하는 데이터 구조입니다. */
type AdminAiPromptVersionDetail = {
  /** Prompt Version이 속한 Family입니다. */
  family: AdminAiPromptFamilyDetail;
  /** 조회된 Prompt Version입니다. */
  version: AdminAiPromptVersionRow;
};

/** useAdminAiPromptVersionDetail 테스트 double이 반환하는 최소 Query 결과입니다. */
type AdminAiPromptVersionDetailQueryState = {
  /** 조회된 Prompt Version 상세 데이터입니다. */
  data?: AdminAiPromptVersionDetail;
  /** 조회 오류 상태입니다. */
  isError: boolean;
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
function mockDetailQueryState(state: AdminAiPromptVersionDetailQueryState) {
  useAdminAiPromptVersionDetailMock.mockReturnValue(state);
}

describe("AdminAiPromptVersionDetailClient", () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    useAdminAiPromptVersionDetailMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({ data: undefined });
  });

  it("상세 조회 오류 상태에서 다시 시도 버튼을 누르면 Prompt Version 상세 Query를 다시 실행한다", async () => {
    const user = userEvent.setup();

    mockDetailQueryState({
      isError: true,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiPromptVersionDetailClient
        familyId="22222222-2222-4222-8222-222222222222"
        versionId="33333333-3333-4333-8333-333333333333"
      />,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
