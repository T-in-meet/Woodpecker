import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptFamilyForm } from "./AdminAiPromptFamilyForm";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

const createMutateAsyncMock = vi.hoisted(() => vi.fn());
const updateMutateAsyncMock = vi.hoisted(() => vi.fn());
const deleteMutateAsyncMock = vi.hoisted(() => vi.fn());

const agentOptionsMock = vi.hoisted(() => [
  {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Note Answer Agent",
  },
]);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../agents/hooks/use-admin-ai-agent-queries", () => ({
  useAdminAiAgentOptions: () => ({
    data: agentOptionsMock,
    isPending: false,
  }),
}));

vi.mock("../hooks/use-admin-ai-prompt-family-mutations", () => ({
  useCreateAdminAiPromptFamily: () => ({
    isPending: false,
    mutateAsync: createMutateAsyncMock,
  }),
  useDeleteAdminAiPromptFamily: () => ({
    isPending: false,
    mutateAsync: deleteMutateAsyncMock,
  }),
  useUpdateAdminAiPromptFamily: () => ({
    isPending: false,
    mutateAsync: updateMutateAsyncMock,
  }),
}));

/**
 * 테스트에서 FormData에 담긴 문자열 값을 읽습니다.
 *
 * @param formData 검증할 FormData
 * @param key 읽을 필드 이름
 * @returns 문자열 FormData 값
 */
function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string FormData value.`);
  }

  return value;
}

/**
 * 수정 모드 테스트에 사용할 Prompt Family 상세 fixture를 생성합니다.
 *
 * @returns 관리자 Prompt Family 상세 데이터
 */
function createFamilyFixture(): AdminAiPromptFamilyDetail {
  return {
    agentDisplayName: "Note Answer Agent",
    agentId: "11111111-1111-4111-8111-111111111111",
    archivedVersionCount: 0,
    createdAt: "2026-08-03T00:00:00.000Z",
    description: "기존 Family 설명",
    displayName: "Note Answer",
    draftVersionCount: 1,
    id: "22222222-2222-4222-8222-222222222222",
    publishedVersionCount: 0,
    tags: ["note", "answer"],
    updatedAt: "2026-08-03T01:00:00.000Z",
    versions: [],
  };
}

describe("AdminAiPromptFamilyForm", () => {
  beforeAll(() => {
    /*
     * Radix Select는 pointer capture API가 있는 브라우저 환경을 전제로 한다.
     * jsdom에는 해당 API가 없으므로 실제 선택 상호작용 테스트를 위해 보강한다.
     */
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }

    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
  });

  beforeEach(() => {
    createMutateAsyncMock.mockReset();
    updateMutateAsyncMock.mockReset();
    deleteMutateAsyncMock.mockReset();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("생성 모드에서 변경 전 저장 버튼을 비활성화한다", () => {
    render(<AdminAiPromptFamilyForm />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("생성 모드에서 값을 변경하면 저장 버튼을 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiPromptFamilyForm />);

    const submitButton = screen.getByRole("button", { name: "저장" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), "Note Answer");

    expect(submitButton).toBeEnabled();
  });

  it("생성 모드에서 Family와 초기 Draft Version 값을 FormData로 전송한다", async () => {
    const user = userEvent.setup();

    createMutateAsyncMock.mockResolvedValue({
      id: "created-family-id",
      ok: true,
    });

    render(<AdminAiPromptFamilyForm />);

    await user.click(screen.getByLabelText("Agent"));
    await user.click(
      await screen.findByRole("option", {
        name: "Note Answer Agent",
      }),
    );

    await user.click(screen.getByLabelText("이름"));
    await user.paste("Note Answer");

    await user.click(screen.getByLabelText("설명"));
    await user.paste("노트 질문 답변에 사용하는 Prompt Family입니다.");

    await user.click(screen.getByLabelText("Tags"));
    await user.paste("note, answer");

    expect(screen.getByLabelText("초기 Version 이름")).toHaveValue("v1 draft");

    await user.click(screen.getByLabelText("변경 요약"));
    await user.paste("초기 Draft Version 생성");

    await user.click(screen.getByLabelText("System Template"));
    await user.paste("You are a helpful assistant.");

    await user.click(screen.getByLabelText("User Template"));
    await user.paste("{{question}}");

    await user.click(screen.getByLabelText("Variables JSON"));
    await user.paste('[{"name":"question"}]');

    await user.click(screen.getByLabelText("Response Schema JSON"));
    await user.paste('{"type":"object"}');

    await user.click(screen.getByRole("button", { name: "저장" }));

    const formData = createMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);

    expect(readFormString(formData, "agentId")).toBe(agentOptionsMock[0]?.id);
    expect(readFormString(formData, "displayName")).toBe("Note Answer");
    expect(readFormString(formData, "description")).toBe(
      "노트 질문 답변에 사용하는 Prompt Family입니다.",
    );
    expect(readFormString(formData, "tags")).toBe("note, answer");

    expect(readFormString(formData, "versionDisplayName")).toBe("v1 draft");
    expect(readFormString(formData, "changeSummary")).toBe(
      "초기 Draft Version 생성",
    );
    expect(readFormString(formData, "systemTemplate")).toBe(
      "You are a helpful assistant.",
    );
    expect(readFormString(formData, "userTemplate")).toBe("{{question}}");
    expect(readFormString(formData, "variables")).toBe('[{"name":"question"}]');
    expect(readFormString(formData, "responseSchema")).toBe(
      '{"type":"object"}',
    );

    expect(formData.get("familyId")).toBeNull();
  });

  it("수정 모드에서 변경 전 수정 버튼을 비활성화하고 변경 후 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiPromptFamilyForm family={createFamilyFixture()} />);

    const submitButton = screen.getByRole("button", { name: "수정" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("수정 모드에서 현재 연결된 Agent 정보를 읽기 전용으로 표시한다", () => {
    const family = createFamilyFixture();

    render(<AdminAiPromptFamilyForm family={family} />);

    const agentLink = screen.getByRole("link", {
      name: family.agentDisplayName,
    });

    expect(agentLink).toBeVisible();
    expect(agentLink).toHaveAttribute(
      "href",
      `/admin/ai/agents/${family.agentId}`,
    );
    expect(screen.queryByText(family.agentId)).not.toBeInTheDocument();
  });

  it("수정 모드에서는 Family 수정 값과 familyId만 전송한다", async () => {
    const user = userEvent.setup();
    const family = createFamilyFixture();

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiPromptFamilyForm family={family} />);

    await user.clear(screen.getByLabelText("이름"));
    await user.type(screen.getByLabelText("이름"), "Updated Family");

    await user.clear(screen.getByLabelText("설명"));
    await user.type(screen.getByLabelText("설명"), "수정된 Family 설명입니다.");

    await user.clear(screen.getByLabelText("Tags"));
    await user.type(screen.getByLabelText("Tags"), "updated, family");

    await user.click(screen.getByRole("button", { name: "수정" }));

    const formData = updateMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);

    expect(readFormString(formData, "familyId")).toBe(family.id);
    expect(readFormString(formData, "displayName")).toBe("Updated Family");
    expect(readFormString(formData, "description")).toBe(
      "수정된 Family 설명입니다.",
    );
    expect(readFormString(formData, "tags")).toBe("updated, family");

    expect(formData.get("agentId")).toBeNull();
    expect(formData.get("versionDisplayName")).toBeNull();
    expect(formData.get("changeSummary")).toBeNull();
    expect(formData.get("systemTemplate")).toBeNull();
    expect(formData.get("userTemplate")).toBeNull();
    expect(formData.get("variables")).toBeNull();
    expect(formData.get("responseSchema")).toBeNull();
  });

  it("수정 성공 후 수정 버튼을 다시 비활성화한다", async () => {
    const user = userEvent.setup();
    const family = createFamilyFixture();

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiPromptFamilyForm family={family} />);

    const submitButton = screen.getByRole("button", { name: "수정" });

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(updateMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("삭제 확인 다이얼로그에서 하위 Published Version 삭제 가능성을 안내한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiPromptFamilyForm family={createFamilyFixture()} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));

    expect(
      await screen.findByText(
        /하위 Published Version도 함께 삭제될 수 있습니다/,
      ),
    ).toBeVisible();
  });
});
