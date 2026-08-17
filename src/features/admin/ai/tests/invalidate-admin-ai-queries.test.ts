import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../agents/constants/query-keys";
import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";
import { ADMIN_AI_PROMPTS_QUERY_KEY } from "../prompts/constants/query-keys";
import {
  ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY,
  ADMIN_AI_SETTINGS_QUERY_KEY,
} from "../settings/constants/query-keys";
import { invalidateAdminAiQueries } from "../utils/invalidate-admin-ai-queries";

describe("invalidateAdminAiQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("서로 참조하는 Admin AI Query 캐시를 모두 무효화한다", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    const queryClient = {
      invalidateQueries,
    };

    await invalidateAdminAiQueries(queryClient as never);

    expect(invalidateQueries).toHaveBeenCalledTimes(5);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_AGENTS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY.all,
    });
  });

  it("모든 Query invalidation이 완료될 때까지 기다린다", async () => {
    let resolveModels: (() => void) | undefined;
    let resolveAgents: (() => void) | undefined;
    let resolvePrompts: (() => void) | undefined;
    let resolveSettings: (() => void) | undefined;
    let resolveConfigurations: (() => void) | undefined;

    const promises = [
      new Promise<void>((resolve) => {
        resolveModels = resolve;
      }),
      new Promise<void>((resolve) => {
        resolveAgents = resolve;
      }),
      new Promise<void>((resolve) => {
        resolvePrompts = resolve;
      }),
      new Promise<void>((resolve) => {
        resolveSettings = resolve;
      }),
      new Promise<void>((resolve) => {
        resolveConfigurations = resolve;
      }),
    ];

    const invalidateQueries = vi
      .fn()
      .mockImplementationOnce(() => promises[0])
      .mockImplementationOnce(() => promises[1])
      .mockImplementationOnce(() => promises[2])
      .mockImplementationOnce(() => promises[3])
      .mockImplementationOnce(() => promises[4]);

    const queryClient = {
      invalidateQueries,
    };

    let completed = false;

    const invalidation = invalidateAdminAiQueries(queryClient as never).then(
      () => {
        completed = true;
      },
    );

    await Promise.resolve();

    expect(completed).toBe(false);

    resolveModels?.();
    resolveAgents?.();
    resolvePrompts?.();
    resolveSettings?.();

    await Promise.resolve();

    // 하나라도 아직 완료되지 않았으면 전체 invalidation 역시 완료되면 안 된다.
    expect(completed).toBe(false);

    resolveConfigurations?.();

    await invalidation;

    expect(completed).toBe(true);
  });
});
