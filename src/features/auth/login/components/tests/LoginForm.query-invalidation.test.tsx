/**
 * LoginForm 로그인 성공 후 query invalidation 테스트
 *
 * 검증 범위:
 * - 로그인 성공 후 ["auth", "session"] invalidate 호출
 * - 로그인 성공 후 ["auth", "user"] invalidate 호출
 * - 로그인 성공 후 ["mypage"] invalidate 호출
 * - invalidate 완료 후 router.push 호출 (순서 보장)
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockMutateAsync,
  mockPush,
  renderLoginForm,
  setupDefaultMocks,
  testQueryClient,
} from "./utils/loginFormTestUtils";

vi.mock("next/navigation");
vi.mock("@/features/auth/login/hooks/useLoginMutation");

async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "user@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "Password1!");
  await user.click(screen.getByRole("button", { name: /^로그인$/ }));
}

describe("LoginForm 로그인 성공 후 query invalidation", () => {
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();

    // testQueryClient.invalidateQueries를 spy로 래핑해 호출 여부와 인자를 검증
    invalidateSpy = vi
      .spyOn(testQueryClient, "invalidateQueries")
      .mockResolvedValue();

    mockMutateAsync.mockResolvedValue({
      success: true,
      code: "LOGIN_SUCCESS",
      data: { redirectTo: "/mypage" },
    });
  });

  it("로그인 성공 후 ['auth', 'session'] 쿼리를 invalidate한다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["auth", "session"],
      });
    });
  });

  it("로그인 성공 후 ['auth', 'user'] 쿼리를 invalidate한다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["auth", "user"],
      });
    });
  });

  it("로그인 성공 후 ['mypage'] 쿼리를 invalidate한다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["mypage"],
      });
    });
  });

  it("모든 invalidate 완료 후 router.push가 호출된다", async () => {
    const callOrder: string[] = [];

    invalidateSpy.mockImplementation(async () => {
      callOrder.push("invalidate");
    });
    mockPush.mockImplementation(() => {
      callOrder.push("push");
    });

    const user = userEvent.setup();
    renderLoginForm();

    await submitValidForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    // invalidate가 모두 push보다 먼저 실행되어야 함
    const pushIndex = callOrder.indexOf("push");
    const invalidateCount = callOrder.filter((v) => v === "invalidate").length;

    expect(invalidateCount).toBe(3);
    expect(pushIndex).toBeGreaterThan(0);
    // push 이전의 모든 항목이 invalidate여야 함
    expect(callOrder.slice(0, pushIndex).every((v) => v === "invalidate")).toBe(
      true,
    );
  });
});
