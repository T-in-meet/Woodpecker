// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";

const routerRefreshMock = vi.hoisted(() => vi.fn());
const publishMutateAsyncMock = vi.hoisted(() => vi.fn());
const archiveMutateAsyncMock = vi.hoisted(() => vi.fn());
const deleteMutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
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
  useArchiveAdminAiPromptVersion: () => ({
    isPending: false,
    mutateAsync: archiveMutateAsyncMock,
  }),
  useDeleteAdminAiPromptVersion: () => ({
    isPending: false,
    mutateAsync: deleteMutateAsyncMock,
  }),
  usePublishAdminAiPromptVersion: () => ({
    isPending: false,
    mutateAsync: publishMutateAsyncMock,
  }),
}));

import { toast } from "sonner";

import { useAdminAiPromptVersionLifecycleActions } from "../hooks/use-admin-ai-prompt-version-lifecycle-actions";

const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

describe("useAdminAiPromptVersionLifecycleActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publish 성공 시 message를 비우고 toast와 refresh를 실행한다", async () => {
    publishMutateAsyncMock.mockResolvedValue({
      ok: true,
    });

    const { result } = renderHook(() =>
      useAdminAiPromptVersionLifecycleActions({
        familyId: FAMILY_ID,
      }),
    );

    await act(async () => {
      await result.current.handlePublishVersion(VERSION_ID);
    });

    expect(publishMutateAsyncMock).toHaveBeenCalledWith(VERSION_ID);
    expect(result.current.message).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(
      "AI Prompt Version을 Publish했습니다.",
    );
    expect(routerRefreshMock).toHaveBeenCalledOnce();
  });

  it("archive 실패 시 server action message를 표시하고 refresh하지 않는다", async () => {
    archiveMutateAsyncMock.mockResolvedValue({
      message: "published version만 archive할 수 있습니다.",
      ok: false,
    });

    const { result } = renderHook(() =>
      useAdminAiPromptVersionLifecycleActions({
        familyId: FAMILY_ID,
      }),
    );

    await act(async () => {
      await result.current.handleArchiveVersion(VERSION_ID);
    });

    expect(archiveMutateAsyncMock).toHaveBeenCalledWith(VERSION_ID);
    expect(result.current.message).toBe(
      "published version만 archive할 수 있습니다.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("delete 성공 시 기본 동작으로 toast와 refresh를 실행한다", async () => {
    deleteMutateAsyncMock.mockResolvedValue({
      ok: true,
    });

    const { result } = renderHook(() =>
      useAdminAiPromptVersionLifecycleActions({
        familyId: FAMILY_ID,
      }),
    );

    await act(async () => {
      await result.current.handleDeleteVersion(VERSION_ID);
    });

    expect(deleteMutateAsyncMock).toHaveBeenCalledWith({
      familyId: FAMILY_ID,
      versionId: VERSION_ID,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "AI Prompt Version을 삭제했습니다.",
    );
    expect(routerRefreshMock).toHaveBeenCalledOnce();
  });

  it("delete 성공 후 onDeleteSuccess가 있으면 기본 refresh 대신 후속 작업을 실행한다", async () => {
    const onDeleteSuccess = vi.fn();

    deleteMutateAsyncMock.mockResolvedValue({
      ok: true,
    });

    const { result } = renderHook(() =>
      useAdminAiPromptVersionLifecycleActions({
        familyId: FAMILY_ID,
        onDeleteSuccess,
      }),
    );

    await act(async () => {
      await result.current.handleDeleteVersion(VERSION_ID);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "AI Prompt Version을 삭제했습니다.",
    );
    expect(onDeleteSuccess).toHaveBeenCalledOnce();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("mutation 예외 발생 시 공통 unknown error toast를 표시한다", async () => {
    publishMutateAsyncMock.mockRejectedValue(new Error("network failed"));

    const { result } = renderHook(() =>
      useAdminAiPromptVersionLifecycleActions({
        familyId: FAMILY_ID,
      }),
    );

    await act(async () => {
      await result.current.handlePublishVersion(VERSION_ID);
    });

    expect(toast.error).toHaveBeenCalledWith(ADMIN_UNKNOWN_ERROR_MESSAGE);
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
