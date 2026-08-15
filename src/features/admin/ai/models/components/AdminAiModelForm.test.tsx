import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";

import { AdminAiModelForm } from "./AdminAiModelForm";

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

vi.mock("../hooks/use-admin-ai-model-mutations", () => ({
  useCreateAdminAiModel: () => ({
    isPending: false,
    mutateAsync: createMutateAsyncMock,
  }),
  useDeleteAdminAiModel: () => ({
    isPending: false,
    mutateAsync: deleteMutateAsyncMock,
  }),
  useUpdateAdminAiModel: () => ({
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
 * 수정 모드 테스트에 사용할 AI 모델 상세 fixtures를 생성합니다.
 *
 * @returns 관리자 AI 모델 상세 데이터
 */
function createModelFixture() {
  return {
    capability: "chat",
    createdAt: "2026-08-03T00:00:00.000Z",
    dimensions: null,
    displayName: "GPT-4o Mini",
    distanceMetric: null,
    embeddingReferenceCount: 0,
    id: "11111111-1111-4111-8111-111111111111",
    isActive: true,
    model: "gpt-4o-mini",
    notes: "기존 메모",
    provider: "openai",
    updatedAt: "2026-08-03T01:00:00.000Z",
  } as const;
}

describe("AdminAiModelForm", () => {
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
    render(<AdminAiModelForm />);

    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("생성 모드에서 Chat 모델의 embedding 전용 값을 빈 값으로 전송한다", async () => {
    const user = userEvent.setup();
    createMutateAsyncMock.mockResolvedValue({ id: "created-id", ok: true });

    render(<AdminAiModelForm />);

    await user.type(screen.getByLabelText("Model"), "gpt-4o-mini");
    await user.type(screen.getByLabelText("이름"), "GPT-4o Mini");
    await user.click(screen.getByRole("button", { name: "저장" }));

    const formData = createMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect(readFormString(formData, "capability")).toBe("chat");
    expect(readFormString(formData, "dimensions")).toBe("");
    expect(readFormString(formData, "distanceMetric")).toBe("");
  });

  it("Embedding 선택 시 dimensions를 고정값으로 전송한다", async () => {
    const user = userEvent.setup();
    createMutateAsyncMock.mockResolvedValue({ id: "created-id", ok: true });

    render(<AdminAiModelForm />);

    await user.click(screen.getByLabelText("모델 용도"));
    await user.click(await screen.findByRole("option", { name: "Embedding" }));
    await user.type(screen.getByLabelText("Model"), "text-embedding-3-small");
    await user.type(screen.getByLabelText("이름"), "Text Embedding 3 Small");
    await user.click(screen.getByRole("button", { name: "저장" }));

    const formData = createMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect(screen.getByLabelText("Dimensions")).toHaveValue(
      AI_EMBEDDING_DIMENSIONS,
    );
    expect(readFormString(formData, "capability")).toBe("embedding");
    expect(readFormString(formData, "dimensions")).toBe(
      String(AI_EMBEDDING_DIMENSIONS),
    );
    expect(readFormString(formData, "distanceMetric")).toBe("cosine");
  });

  it("수정 모드에서 변경 전 수정 버튼을 비활성화하고 변경 후 활성화한다", async () => {
    const user = userEvent.setup();

    render(<AdminAiModelForm model={createModelFixture()} />);

    const submitButton = screen.getByRole("button", { name: "수정" });

    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("이름"), " Updated");

    expect(submitButton).toBeEnabled();
  });

  it("수정 모드에서는 수정 가능한 값과 modelConfigId만 전송한다", async () => {
    const user = userEvent.setup();
    const model = createModelFixture();
    updateMutateAsyncMock.mockResolvedValue({ ok: true });

    render(<AdminAiModelForm model={model} />);

    await user.clear(screen.getByLabelText("이름"));
    await user.type(screen.getByLabelText("이름"), "GPT-4o Mini Updated");
    await user.click(screen.getByRole("button", { name: "수정" }));

    const formData = updateMutateAsyncMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect(readFormString(formData, "modelConfigId")).toBe(model.id);
    expect(readFormString(formData, "displayName")).toBe("GPT-4o Mini Updated");
    expect(formData.get("provider")).toBeNull();
    expect(formData.get("model")).toBeNull();
    expect(formData.get("capability")).toBeNull();
    expect(formData.get("dimensions")).toBeNull();
    expect(formData.get("distanceMetric")).toBeNull();
  });
});
