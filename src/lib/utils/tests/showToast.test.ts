/**
 * showToast 단위 테스트
 *
 * 검증 범위:
 * - 성공 3초, 오류 6초로 둘 다 스스로 사라진다
 * - id는 dedupeKey를 준 경우에만 붙는다
 *
 * 스스로 사라지는 것이 toast의 정체성이다. 조치가 필요한 오류는 toast가 아니라
 * 인라인 메시지로 알리므로, 여기서 duration을 무한대로 늘릴 이유가 없다.
 * 오히려 사라지지 않는 toast는 sonner가 3개까지만 그리는 스택을 막아
 * 뒤이은 오류를 통째로 가린다.
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

  it("오류는 읽을 시간을 벌어 6초 뒤 사라진다", () => {
    showToast("실패했습니다.", { variant: "destructive" });

    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("실패했습니다.", {
      duration: 6000,
    });
  });

  it("dedupeKey가 없으면 오류에도 id를 붙이지 않는다", () => {
    const message = "복습 완료 상태를 바꾸지 못했습니다.";

    // 메시지로 id를 만들면 이미 스택 뒤로 밀린 토스트를 제자리에서 갱신만 해
    // 재시도해도 아무것도 보이지 않는다. 새 토스트로 올라오게 둔다.
    showToast(message, { variant: "destructive" });
    showToast(message, { variant: "destructive" });

    expect(errorToastIds()).toEqual([undefined, undefined]);
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

  it("duration을 직접 주면 기본값 대신 그 값을 쓴다", () => {
    showToast("실패했습니다.", { variant: "destructive", duration: 5000 });

    expect(toast.error).toHaveBeenCalledWith("실패했습니다.", {
      duration: 5000,
    });
  });
});
