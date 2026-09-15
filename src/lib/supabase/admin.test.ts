import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "./admin";

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("createAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("옵션이 없으면 기존 Admin client 생성 계약을 유지한다", () => {
    createAdminClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
    );
  });

  it("custom fetch가 있으면 Supabase global fetch로 전달한다", () => {
    const customFetch: typeof fetch = async () => new Response();

    createAdminClient({
      fetch: customFetch,
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        global: {
          fetch: customFetch,
        },
      },
    );
  });
});
