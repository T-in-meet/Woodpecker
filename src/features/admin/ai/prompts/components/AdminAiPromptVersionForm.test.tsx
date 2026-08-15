import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiPromptVersionRow } from "../../types";
import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptVersionForm } from "./AdminAiPromptVersionForm";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

const createMutateAsyncMock = vi.hoisted(() => vi.fn());
const updateMutateAsyncMock = vi.hoisted(() => vi.fn());

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

vi.mock("../hooks/use-admin-ai-prompt-version-mutations", () => ({
  useCreateAdminAiPromptVersion: () => ({
    isPending: false,
    mutateAsync: createMutateAsyncMock,
  }),
  useUpdateAdminAiPromptVersion: () => ({
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
 * Prompt Version 테스트 fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 Version 값
 * @returns 관리자 Prompt Version 데이터
 */
function createVersionFixture(
  overrides: Partial<AdminAiPromptVersionRow> = {},
): AdminAiPromptVersionRow {
  return {
    changeSummary: "기존 변경 요약",
    createdAt: "2026-08-03T00:00:00.000Z",
    createdBy: null,
    createdByKind: "admin",
    displayName: "v1",
    familyId: "22222222-2222-4222-8222-222222222222",
    id: "33333333-3333-4333-8333-333333333333",
    lifecycleStatus: "draft",
    responseSchema: {
      type: "object",
    },
    systemTemplate: "기존 System Template",
    tags: ["note", "answer"],
    userTemplate: "기존 User Template",
    variables: [
      {
        name: "question",
      },
    ],
    versionNumber: 1,
    ...overrides,
  };
}

/**
 * Prompt Family 테스트 fixture를 생성합니다.
 *
 * @param versions Family에 연결할 Version 목록
 * @returns 관리자 Prompt Family 상세 데이터
 */
function createFamilyFixture(
  versions: AdminAiPromptVersionRow[] = [],
): AdminAiPromptFamilyDetail {
  return {
    agentDisplayName: "Note Answer Agent",
    agentId: "11111111-1111-4111-8111-111111111111",
    archivedVersionCount: 0,
    createdAt: "2026-08-03T00:00:00.000Z",
    description: "기존 Family 설명",
    displayName: "Note Answer",
    draftVersionCount: versions.filter(
      (version) => version.lifecycleStatus === "draft",
    ).length,
    id: "22222222-2222-4222-8222-222222222222",
    publishedVersionCount: versions.filter(
      (version) => version.lifecycleStatus === "published",
    ).length,
    tags: ["note", "answer"],
    updatedAt: "2026-08-03T01:00:00.000Z",
    versions,
  };
}

describe("AdminAiPromptVersionForm", () => {
  beforeEach(() => {
    createMutateAsyncMock.mockReset();
    updateMutateAsyncMock.mockReset();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("생성 모드에서 변경 전 저장 버튼을 비활성화한다", () => {
    render(<AdminAiPromptVersionForm family={createFamilyFixture()} />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("생성 모드에서 값을 변경하면 저장 버튼을 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiPromptVersionForm family={createFamilyFixture()} />);

    const submitButton = screen.getByRole("button", { name: "저장" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("생성 모드에서 Family ID와 Version 입력 값을 FormData로 전송한다", async () => {
    const user = userEvent.setup();
    const family = createFamilyFixture();

    createMutateAsyncMock.mockResolvedValue({
      id: "created-version-id",
      ok: true,
    });

    render(<AdminAiPromptVersionForm family={family} />);

    await user.clear(screen.getByLabelText("이름"));
    await user.type(screen.getByLabelText("이름"), "v2 draft");

    await user.type(screen.getByLabelText("Tags"), "prompt, draft");
    await user.type(
      screen.getByLabelText("변경 요약"),
      "새 Draft Version 생성",
    );

    await user.type(
      screen.getByLabelText("System Template"),
      "You are a helpful assistant.",
    );

    await user.click(screen.getByLabelText("User Template"));
    await user.paste("질문: {{question}}");

    const variablesField = screen.getByLabelText("Variables JSON");
    await user.clear(variablesField);
    await user.click(variablesField);
    await user.paste('[{"name":"question"}]');

    const responseSchemaField = screen.getByLabelText("Response Schema JSON");
    await user.clear(responseSchemaField);
    await user.click(responseSchemaField);
    await user.paste('{"type":"object"}');

    await user.click(screen.getByRole("button", { name: "저장" }));

    const formData = createMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);

    expect(readFormString(formData, "familyId")).toBe(family.id);
    expect(formData.get("versionId")).toBeNull();

    expect(readFormString(formData, "versionDisplayName")).toBe("v2 draft");
    expect(readFormString(formData, "tags")).toBe("prompt, draft");
    expect(readFormString(formData, "changeSummary")).toBe(
      "새 Draft Version 생성",
    );
    expect(readFormString(formData, "systemTemplate")).toBe(
      "You are a helpful assistant.",
    );
    expect(readFormString(formData, "userTemplate")).toBe("질문: {{question}}");
    expect(readFormString(formData, "variables")).toBe('[{"name":"question"}]');
    expect(readFormString(formData, "responseSchema")).toBe(
      '{"type":"object"}',
    );
  });

  it("기존 Version이 있으면 생성 화면의 기본값으로 사용한다", () => {
    const sourceVersion = createVersionFixture();

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([sourceVersion])}
      />,
    );

    expect(screen.getByLabelText("이름")).toHaveValue(
      sourceVersion.displayName,
    );
    expect(screen.getByLabelText("Tags")).toHaveValue("note, answer");
    expect(screen.getByLabelText("변경 요약")).toHaveValue(
      sourceVersion.changeSummary,
    );
    expect(screen.getByLabelText("System Template")).toHaveValue(
      sourceVersion.systemTemplate,
    );
    expect(screen.getByLabelText("User Template")).toHaveValue(
      sourceVersion.userTemplate,
    );
  });

  it("Draft 수정 모드에서 변경 전 수정 버튼을 비활성화하고 변경 후 활성화한다", async () => {
    const user = userEvent.setup();
    const version = createVersionFixture({
      lifecycleStatus: "draft",
    });

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([version])}
        version={version}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "수정" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("Draft 수정 모드에서 Version ID와 수정 값을 FormData로 전송한다", async () => {
    const user = userEvent.setup();
    const version = createVersionFixture({
      lifecycleStatus: "draft",
    });
    const family = createFamilyFixture([version]);

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiPromptVersionForm family={family} version={version} />);

    await user.clear(screen.getByLabelText("이름"));
    await user.type(screen.getByLabelText("이름"), "v1 Updated");

    await user.click(screen.getByRole("button", { name: "수정" }));

    const formData = updateMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);

    expect(readFormString(formData, "familyId")).toBe(family.id);
    expect(readFormString(formData, "versionId")).toBe(version.id);
    expect(readFormString(formData, "versionDisplayName")).toBe("v1 Updated");
  });

  it("Draft 수정 성공 후 수정 버튼을 다시 비활성화한다", async () => {
    const user = userEvent.setup();
    const version = createVersionFixture({
      lifecycleStatus: "draft",
    });

    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([version])}
        version={version}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "수정" });

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(updateMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("Published Version에서는 Template을 읽기 전용으로 표시한다", () => {
    const version = createVersionFixture({
      lifecycleStatus: "published",
    });

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([version])}
        version={version}
      />,
    );

    expect(screen.getByLabelText("System Template")).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText("User Template")).toHaveAttribute("readonly");

    expect(
      screen.getByText(
        "Published Version의 System/User Template은 수정할 수 없습니다.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "수정" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
  });

  it("Published Version에서는 관리 필드를 변경할 수 있다", async () => {
    const user = userEvent.setup();
    const version = createVersionFixture({
      lifecycleStatus: "published",
    });

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([version])}
        version={version}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "수정" });

    await user.type(screen.getByLabelText("변경 요약"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("Archived Version은 읽기 전용으로 표시하고 수정 버튼을 렌더링하지 않는다", () => {
    const version = createVersionFixture({
      lifecycleStatus: "archived",
    });

    render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture([version])}
        version={version}
      />,
    );

    expect(screen.getByLabelText("이름")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Tags")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("변경 요약")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("System Template")).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText("User Template")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Variables JSON")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Response Schema JSON")).toHaveAttribute(
      "readonly",
    );

    expect(
      screen.getByText("Archived Version은 수정할 수 없습니다."),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "수정" }),
    ).not.toBeInTheDocument();
  });

  it("Draft와 Archived Version에서 삭제 버튼을 표시한다", () => {
    const onDelete = vi.fn();

    const { rerender } = render(
      <AdminAiPromptVersionForm
        family={createFamilyFixture()}
        version={createVersionFixture({
          lifecycleStatus: "draft",
        })}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();

    rerender(
      <AdminAiPromptVersionForm
        family={createFamilyFixture()}
        version={createVersionFixture({
          lifecycleStatus: "archived",
        })}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });
});
