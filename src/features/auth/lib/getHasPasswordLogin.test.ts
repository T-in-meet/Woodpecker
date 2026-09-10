import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { getHasPasswordLogin } from "./getHasPasswordLogin";

describe("getHasPasswordLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClientMock.mockReturnValue({ rpc: rpcMock });
  });

  it("서버 전용 RPC가 반환한 비밀번호 존재 여부를 그대로 반환한다", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    await expect(getHasPasswordLogin("user-id")).resolves.toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("has_password_login", {
      p_user_id: "user-id",
    });
  });

  it("RPC 조회 오류를 비밀번호 미설정으로 처리하지 않고 전파한다", async () => {
    const rpcError = new Error("RPC failed");
    rpcMock.mockResolvedValue({ data: null, error: rpcError });

    await expect(getHasPasswordLogin("user-id")).rejects.toBe(rpcError);
  });
});
