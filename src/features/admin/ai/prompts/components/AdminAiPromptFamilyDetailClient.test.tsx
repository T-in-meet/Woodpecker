import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptFamilyDetailClient } from "./AdminAiPromptFamilyDetailClient";

const useAdminAiPromptFamilyDetailMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin/components/common/AdminCollapsibleSection", () => ({
  AdminCollapsibleSection: ({
    children,
    title,
  }: {
    /** 섹션 내부에 렌더링할 테스트용 콘텐츠입니다. */
    children: ReactNode;
    /** 섹션 제목입니다. */
    title: string;
  }) => <section aria-label={title}>{children}</section>,
}));

vi.mock(
  "@/features/admin/components/layout/AdminBreadcrumbDynamicItems",
  () => ({
    AdminBreadcrumbDynamicItems: () => <nav aria-label="breadcrumb" />,
  }),
);

vi.mock("@/features/admin/components/layout/AdminDetailPageHeader", () => ({
  AdminDetailPageHeader: ({
    description,
    title,
  }: {
    /** 헤더 설명입니다. */
    description: string;
    /** 헤더 제목입니다. */ title: string;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../hooks/use-admin-ai-prompt-queries", () => ({
  useAdminAiPromptFamilyDetail: useAdminAiPromptFamilyDetailMock,
}));

vi.mock("./AdminAiPromptFamilyDetailSkeleton", () => ({
  AdminAiPromptFamilyDetailSkeleton: () => <div>상세 로딩 중</div>,
}));

vi.mock("./AdminAiPromptFamilyForm", () => ({
  AdminAiPromptFamilyForm: () => <form aria-label="prompt family form" />,
}));

vi.mock("./AdminAiPromptVersionsSection", () => ({
  AdminAiPromptVersionsSection: () => <div>prompt versions</div>,
}));

/** useAdminAiPromptFamilyDetail 테스트 double이 반환하는 최소 Query 결과입니다. */
type AdminAiPromptFamilyDetailQueryState = {
  /** 조회된 Prompt Family 상세 데이터입니다. */
  data?: AdminAiPromptFamilyDetail;
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
function mockDetailQueryState(state: AdminAiPromptFamilyDetailQueryState) {
  useAdminAiPromptFamilyDetailMock.mockReturnValue(state);
}

describe("AdminAiPromptFamilyDetailClient", () => {
  beforeEach(() => {
    useAdminAiPromptFamilyDetailMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({ data: undefined });
  });

  it("상세 조회 오류 상태에서 다시 시도 버튼을 누르면 Prompt Family 상세 Query를 다시 실행한다", async () => {
    const user = userEvent.setup();

    mockDetailQueryState({
      isError: true,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiPromptFamilyDetailClient familyId="22222222-2222-4222-8222-222222222222" />,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it("Prompt Family 상세 설명에서 실제 필드 정책을 안내한다", () => {
    mockDetailQueryState({
      data: {
        agentDisplayName: "Note Answer Agent",
        agentId: "11111111-1111-4111-8111-111111111111",
        archivedVersionCount: 0,
        createdAt: "2026-08-03T00:00:00.000Z",
        description: "기존 Family 설명",
        displayName: "Note Answer",
        draftVersionCount: 0,
        id: "22222222-2222-4222-8222-222222222222",
        publishedVersionCount: 0,
        tags: [],
        updatedAt: "2026-08-03T01:00:00.000Z",
        versions: [],
      },
      isError: false,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiPromptFamilyDetailClient familyId="22222222-2222-4222-8222-222222222222" />,
    );

    expect(
      screen.getByText(/Agent 연결은 생성 후 변경할 수 없습니다/),
    ).toBeVisible();
    expect(screen.queryByText(/key는 생성 후 변경할 수 없습니다/)).toBeNull();
  });
});
