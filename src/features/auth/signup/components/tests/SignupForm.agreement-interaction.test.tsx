import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { showToast } from "@/lib/utils/showToast";

import { renderSignupForm } from "./utils/signupFormTestUtils";

const signInWithOAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// 소셜 회원가입 테스트는 외부 provider redirect 없이 Supabase 호출 여부만 확인한다.
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
    },
  })),
}));

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

// SignupForm 동의 상호작용 테스트
// - interactionEnabled 상태 관리 및 전이
// - 마우스 + 키보드 인터셉트
// - 라벨/체크박스/버튼 모달 연결
// - 독립적 상태 관리 (termsOfService/privacyPolicy 분리)
// - form reset 시 상태 초기화

describe("회원가입 폼 동의 상호작용", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithOAuthMock.mockResolvedValue({ error: null });
  });

  it('TC-01: 초기 렌더 시 이용약관 체크박스에 aria-disabled="true"가 설정된다', () => {
    renderSignupForm();

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");

    // 이유: interactionEnabled=false 상태에서 aria-disabled로 상호작용 불가 표시
    expect(termsCheckbox).toHaveAttribute("aria-disabled", "true");
  });

  it("TC-02: 초기 렌더 시 이용약관 체크박스 클릭 → 이용약관 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");

    // 이유: interactionEnabled=false 상태에서 체크박스 클릭은 모달을 열어야 함
    await user.click(termsCheckbox);

    // 모달 열림 확인 — "동의하기" 버튼이 보여야 함
    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();
  });

  it("TC-03: 초기 렌더 시 이용약관 라벨 클릭 → 이용약관 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    const termsLabel = screen.getByText("이용약관에 동의합니다");

    // 이유: Label도 마찬가지로 interactionEnabled=false에서는 모달을 열어야 함
    await user.click(termsLabel);

    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();
  });

  it("TC-04: 초기 렌더 시 이용약관 체크박스에 Space 키 입력 → 이용약관 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    termsCheckbox.focus();

    // 이유: 키보드로도 disabled 우회를 방지하기 위해 인터셉트
    await user.keyboard(" ");

    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();
  });

  it("TC-05: 이용약관 모달을 동의 없이 닫으면 체크박스의 aria-disabled가 제거된다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 모달 열기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();

    // 닫기 버튼으로 모달 닫기 (동의 없이)
    // 이유: 모달을 열고 닫기만 해도 interactionEnabled=true로 전환 (스펙 명시)
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // aria-disabled 제거 확인
    await waitFor(() => {
      const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
      expect(termsCheckbox).not.toHaveAttribute("aria-disabled", "true");
    });
  });

  it("TC-06: 이용약관 모달을 동의 없이 닫으면 체크박스 직접 클릭으로 체크 가능하다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 모달 열고 닫기 (동의 없이)
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // 이제 체크박스를 직접 클릭할 수 있어야 함
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");

    // 이유: interactionEnabled=true 상태에서 체크박스 정상 조작 가능
    await user.click(termsCheckbox);

    // 체크된 상태 확인
    await waitFor(() => {
      expect(termsCheckbox).toBeChecked();
    });
  });

  it("TC-07: interactionEnabled=true 상태에서 Space 키로 체크박스 정상 토글 가능하다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");

    await waitFor(() => {
      expect(termsCheckbox).not.toHaveAttribute("aria-disabled", "true");
    });

    termsCheckbox.focus();

    await waitFor(() => {
      expect(termsCheckbox).toHaveFocus();
    });

    await user.keyboard("[Space]");

    await waitFor(() => {
      expect(termsCheckbox).toBeChecked();
    });

    await user.keyboard("[Space]");

    await waitFor(() => {
      expect(termsCheckbox).not.toBeChecked();
    });
  });

  it('TC-08: "동의하기" 클릭 시 이용약관 체크박스가 체크 상태가 된다', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 모달 열기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));

    // "동의하기" 클릭
    // 이유: onAgree 콜백에서 setValue("termsOfService", true)를 호출하기 때문
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 체크박스가 체크된 상태 확인
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await waitFor(() => {
      expect(termsCheckbox).toBeChecked();
    });
  });

  it('TC-09: "동의하기" 후 모달이 닫힌다', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 모달 열기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();

    // "동의하기" 클릭
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 모달 닫힘 확인
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /동의하기/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("TC-10: 개인정보 체크박스/라벨 클릭 → 개인정보 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 개인정보 체크박스 클릭
    const privacyCheckbox = screen.getByTestId("privacy-policy-checkbox");
    await user.click(privacyCheckbox);

    // 개인정보 모달이 열려야 함 (제목이 보여야 함)
    // 이유: 각 동의별로 독립적인 모달 관리
    expect(screen.getByText(/개인정보의 처리 목적/i)).toBeInTheDocument();
  });

  it("TC-11: 이용약관 interactionEnabled와 개인정보 interactionEnabled는 독립적이다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    // 이용약관 모달만 열고 닫기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // 이용약관 체크박스: aria-disabled 제거
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await waitFor(() => {
      expect(termsCheckbox).not.toHaveAttribute("aria-disabled", "true");
    });

    // 개인정보 체크박스: aria-disabled 유지 (독립적)
    const privacyCheckbox = screen.getByTestId("privacy-policy-checkbox");

    // 이유: 각 동의는 독립적인 interactionEnabled 상태를 가져야 함
    expect(privacyCheckbox).toHaveAttribute("aria-disabled", "true");
  });

  it("TC-12: 동의 후 체크박스를 다시 클릭해 unchecked 가능하다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");

    await waitFor(() => {
      expect(termsCheckbox).toHaveAttribute("aria-checked", "true");
    });

    await user.click(termsCheckbox);

    await waitFor(() => {
      expect(termsCheckbox).toHaveAttribute("aria-checked", "false");
    });
  });

  it('TC-13: 컴포넌트 재마운트 시 aria-disabled="true" 초기 상태가 복원된다', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSignupForm();

    // 모달 열고 닫기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // 이제 aria-disabled가 제거되어 있음
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await waitFor(() => {
      expect(termsCheckbox).not.toHaveAttribute("aria-disabled", "true");
    });

    // 컴포넌트를 재마운트하면 내부 interaction 상태는 초기값(false)으로 복원되어야 한다.
    unmount();
    renderSignupForm();

    await waitFor(() => {
      expect(screen.getByTestId("terms-of-service-checkbox")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  it("TC-14: 컴포넌트 재마운트 후 체크박스 클릭 시 다시 모달이 열린다", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSignupForm();

    // 모달 열고 닫기
    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /닫기/i }));

    // 이제 체크박스 직접 클릭 가능 (aria-disabled 제거됨)
    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    await waitFor(() => {
      expect(termsCheckbox).not.toHaveAttribute("aria-disabled", "true");
    });

    // 재마운트 후에는 다시 초기 blocked 상태로 돌아가야 한다.
    unmount();
    renderSignupForm();

    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();
  });

  it("TC-15: 초기 렌더 시 이용약관 체크박스에 Enter 키 입력 → 이용약관 모달이 열린다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    const termsCheckbox = screen.getByTestId("terms-of-service-checkbox");
    termsCheckbox.focus();

    // 이유: 키보드로도 disabled 우회를 방지하기 위해 인터셉트 (Space와 동일한 인터셉트 대상)
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: /동의하기/i })).toBeVisible();
  });

  it('TC-16: 이용약관 모달에서 "동의하기" 후 개인정보 체크박스로 포커스가 이동한다', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("privacy-policy-checkbox"),
      );
    });
  });

  it('TC-17: 개인정보 모달에서 "동의하기" 후 회원가입 버튼으로 포커스가 이동한다', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(screen.getByTestId("privacy-policy-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /^회원가입$/i }),
      );
    });
  });

  it('TC-18: 트리거 버튼으로 개인정보 모달을 열어 "동의하기"해도 회원가입 버튼으로 포커스가 이동한다', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(
      screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
    );
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /^회원가입$/i }),
      );
    });
  });

  it("TC-19: 제출 버튼이 disabled면 개인정보 동의 후 로그인 링크로 포커스가 이동한다", async () => {
    const user = userEvent.setup();
    renderSignupForm({ isPending: true });

    await user.click(screen.getByTestId("privacy-policy-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: /로그인/i }),
      );
    });
  });

  it("TC-20: 초기 렌더 시 소셜 회원가입 버튼은 클릭 가능한 상태로 렌더링된다", () => {
    renderSignupForm();

    expect(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    ).not.toBeDisabled();
  });

  it("TC-21: 약관 미동의 상태에서 소셜 회원가입을 클릭하면 toast를 표시한다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    expect(showToast).toHaveBeenCalledWith(
      "회원가입하려면 이용약관과 개인정보 처리방침에 동의해주세요.",
      {
        variant: "destructive",
        dedupeKey: "auth-signup-agreements-required",
      },
    );
  });

  it("TC-22: 이용약관과 개인정보 처리방침에 모두 동의하면 소셜 회원가입을 시작한다", async () => {
    const user = userEvent.setup();
    renderSignupForm();

    await user.click(screen.getByTestId("terms-of-service-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));
    await user.click(screen.getByTestId("privacy-policy-checkbox"));
    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    // 두 약관이 모두 체크된 뒤에는 SignupForm의 beforeSignIn gate를 통과한다.
    await user.click(
      screen.getByRole("button", { name: "Google 계정으로 계속하기" }),
    );

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("/api/auth/callback"),
        },
      });
    });
    expect(showToast).not.toHaveBeenCalledWith(
      "회원가입하려면 이용약관과 개인정보 처리방침에 동의해주세요.",
      expect.anything(),
    );
  });
});
