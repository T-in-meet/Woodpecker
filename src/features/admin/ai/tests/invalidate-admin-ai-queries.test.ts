import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";
import { invalidateAdminAiQueries } from "../utils/invalidate-admin-ai-queries";

describe("invalidateAdminAiQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Admin AI 모델 Query 캐시를 무효화한다", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    const queryClient = {
      invalidateQueries,
    };

    await invalidateAdminAiQueries(queryClient as never);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
    });
  });

  it("Query invalidation이 완료될 때까지 기다린다", async () => {
    let resolveModels: (() => void) | undefined;

    const invalidationPromise = new Promise<void>((resolve) => {
      resolveModels = resolve;
    });

    const invalidateQueries = vi.fn().mockReturnValue(invalidationPromise);

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

    await invalidation;

    expect(completed).toBe(true);
  });
});
