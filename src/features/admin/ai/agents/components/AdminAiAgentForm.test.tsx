import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAiAgentDetail } from "../types";
import { AdminAiAgentForm } from "./AdminAiAgentForm";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const createMutateAsyncMock = vi.hoisted(() => vi.fn());
const updateMutateAsyncMock = vi.hoisted(() => vi.fn());
const deleteMutateAsyncMock = vi.hoisted(() => vi.fn());

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

vi.mock("../hooks/use-admin-ai-agent-mutations", () => ({
  useCreateAdminAiAgent: () => ({
    isPending: false,
    mutateAsync: createMutateAsyncMock,
  }),
  useDeleteAdminAiAgent: () => ({
    isPending: false,
    mutateAsync: deleteMutateAsyncMock,
  }),
  useUpdateAdminAiAgent: () => ({
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
 * 수정 모드 테스트에 사용할 AI Agent 상세 fixture를 생성합니다.
 *
 * @returns 관리자 AI Agent 상세 데이터
 */
function createAgentFixture(): AdminAiAgentDetail {
  return {
    createdAt: "2026-08-03T00:00:00.000Z",
    description: "기존 Agent 설명",
    displayName: "Note Answer Agent",
    familyCount: 0,
    families: [],
    id: "11111111-1111-4111-8111-111111111111",
    purpose: "노트 질문에 답변합니다.",
    tags: ["note", "answer"],
    updatedAt: "2026-08-03T01:00:00.000Z",
    versionCount: 0,
  };
}

describe("AdminAiAgentForm", () => {
  beforeEach(() => {
    createMutateAsyncMock.mockReset();
    updateMutateAsyncMock.mockReset();
    deleteMutateAsyncMock.mockReset();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("생성 모드에서 변경 전 저장 버튼을 비활성화한다", () => {
    render(<AdminAiAgentForm />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("생성 모드에서 값을 변경하면 저장 버튼을 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiAgentForm />);

    const submitButton = screen.getByRole("button", { name: "저장" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), "Note Answer Agent");

    expect(submitButton).toBeEnabled();
  });

  it("생성 모드에서 Agent 입력 값을 FormData로 전송한다", async () => {
    const user = userEvent.setup();

    createMutateAsyncMock.mockResolvedValue({
      id: "created-agent-id",
      ok: true,
    });

    render(<AdminAiAgentForm />);

    await user.type(screen.getByLabelText("이름"), "Note Answer Agent");
    await user.type(screen.getByLabelText("목적"), "노트 질문에 답변합니다.");
    await user.type(
      screen.getByLabelText("설명"),
      "노트 문맥을 기반으로 답변을 생성합니다.",
    );
    await user.type(screen.getByLabelText("Tags"), "note, answer");

    await user.click(screen.getByRole("button", { name: "저장" }));

    const formData = createMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect(readFormString(formData, "displayName")).toBe("Note Answer Agent");
    expect(readFormString(formData, "purpose")).toBe("노트 질문에 답변합니다.");
    expect(readFormString(formData, "description")).toBe(
      "노트 문맥을 기반으로 답변을 생성합니다.",
    );
    expect(readFormString(formData, "tags")).toBe("note, answer");
    expect(formData.get("agentId")).toBeNull();
  });

  it("수정 모드에서 변경 전 수정 버튼을 비활성화하고 변경 후 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiAgentForm agent={createAgentFixture()} />);

    const submitButton = screen.getByRole("button", { name: "수정" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("수정 모드에서 Agent ID와 수정 값을 FormData로 전송한다", async () => {
    const user = userEvent.setup();
    const agent = createAgentFixture();

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiAgentForm agent={agent} />);

    await user.clear(screen.getByLabelText("이름"));
    await user.type(screen.getByLabelText("이름"), "Updated Agent");

    await user.clear(screen.getByLabelText("목적"));
    await user.type(screen.getByLabelText("목적"), "수정된 목적입니다.");

    await user.clear(screen.getByLabelText("설명"));
    await user.type(screen.getByLabelText("설명"), "수정된 Agent 설명입니다.");

    await user.clear(screen.getByLabelText("Tags"));
    await user.type(screen.getByLabelText("Tags"), "updated, agent");

    await user.click(screen.getByRole("button", { name: "수정" }));

    const formData = updateMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect(readFormString(formData, "agentId")).toBe(agent.id);
    expect(readFormString(formData, "displayName")).toBe("Updated Agent");
    expect(readFormString(formData, "purpose")).toBe("수정된 목적입니다.");
    expect(readFormString(formData, "description")).toBe(
      "수정된 Agent 설명입니다.",
    );
    expect(readFormString(formData, "tags")).toBe("updated, agent");
  });

  it("수정 성공 후 수정 버튼을 다시 비활성화한다", async () => {
    const user = userEvent.setup();
    const agent = createAgentFixture();

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiAgentForm agent={agent} />);

    const submitButton = screen.getByRole("button", { name: "수정" });

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(updateMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
  });
});
