/**
 * showToast 단위 테스트
 *
 * 검증 범위:
 * - 성공 안내는 3초 뒤 사라지고, 오류는 스스로 사라지지 않는다
 * - 사라지지 않는 오류에 중복 방지 id가 붙는지 (dedupeKey / 메시지 기반)
 *
 * sonner는 화면에 3개까지만 그린다. 사라지지 않는 오류가 id 없이 쌓이면
 * 네 번째 실패부터는 토스트가 아예 보이지 않으므로, id 부여 규칙을 고정한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { showToast } from "../showToast";

const { toast } = vi.hoisted(() => {
  type ToastFn = (
    message: string,
    options: { duration: number; id?: string },
  ) => void;

  return {
    toast: Object.assign(vi.fn<ToastFn>(), { error: vi.fn<ToastFn>() }),
  };
});

vi.mock("sonner", () => ({ toast }));

/** toast.error 호출들에 실린 id 목록. */
function errorToastIds() {
  return toast.error.mock.calls.map((call) => call[1].id);
}

describe("showToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("성공 안내는 3초 뒤 사라지고 중복 방지 id를 붙이지 않는다", () => {
    showToast("저장되었습니다.");

    expect(toast).toHaveBeenCalledWith("저장되었습니다.", { duration: 3000 });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("오류는 스스로 사라지지 않는다", () => {
    showToast("실패했습니다.", { variant: "destructive" });

    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "실패했습니다.",
      expect.objectContaining({ duration: Infinity }),
    );
  });

  it("dedupeKey 없이 같은 오류를 반복해도 같은 자리에서 갱신한다", () => {
    const message = "복습 완료 상태를 바꾸지 못했습니다.";

    showToast(message, { variant: "destructive" });
    showToast(message, { variant: "destructive" });

    const [first, second] = errorToastIds();

    expect(first).toBeDefined();
    expect(second).toBe(first);
  });

  it("서로 다른 오류 메시지는 각각의 토스트로 남는다", () => {
    showToast("노트를 삭제하지 못했습니다.", { variant: "destructive" });
    showToast("복습을 시작하지 못했습니다.", { variant: "destructive" });

    const [first, second] = errorToastIds();

    expect(second).not.toBe(first);
  });

  it("dedupeKey를 주면 메시지가 달라도 같은 자리에서 갱신한다", () => {
    showToast("요청이 너무 많습니다.", {
      variant: "destructive",
      dedupeKey: "auth-rate-limit",
    });
    showToast("잠시 후 다시 시도해주세요.", {
      variant: "destructive",
      dedupeKey: "auth-rate-limit",
    });

    expect(errorToastIds()).toEqual(["auth-rate-limit", "auth-rate-limit"]);
  });

  it("duration을 직접 주면 스스로 사라지므로 id를 붙이지 않는다", () => {
    showToast("실패했습니다.", { variant: "destructive", duration: 5000 });

    expect(toast.error).toHaveBeenCalledWith("실패했습니다.", {
      duration: 5000,
    });
  });
});
