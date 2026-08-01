import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OAUTH_CALLBACK_ERROR_REASON,
  OAUTH_CALLBACK_ERROR_TOAST_KEY,
  OAUTH_CALLBACK_ERROR_TOAST_MESSAGE,
} from "@/features/auth/constants/oauthCallbackError";
import SignupPageClient from "@/features/auth/signup/components/SignupPageClient";
import { showToast } from "@/lib/utils/showToast";

const mockPush = vi.fn();
const mockMutateAsync = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: vi.fn(() => mockSearchParams()),
}));

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@/features/auth/signup/hooks/useSignupMutation", () => ({
  useSignupMutation: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

async function submitValidSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /이메일로 가입/i }));

  fireEvent.change(screen.getByLabelText(/이메일/i), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
    target: { value: "password123" },
  });
  fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
    target: { value: "password123" },
  });
  fireEvent.change(screen.getByLabelText(/닉네임/i), {
    target: { value: "tester" },
  });
  // interactionEnabled=false 상태에서 체크박스 클릭이 모달을 열므로 모달 경유
  // 이유: agreement-interaction-control-spec에서 모달-먼저 상호작용 강제
  await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));
  const termsDialog = await screen.findByRole("dialog");
  await user.click(
    within(termsDialog).getByRole("button", { name: /동의하기/i }),
  );
  // 즉시 언마운트/애니메이션 지연 모두 허용
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  await user.click(
    screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
  );
  const privacyDialog = await screen.findByRole("dialog");
  await user.click(
    within(privacyDialog).getByRole("button", { name: /동의하기/i }),
  );
  // 즉시 언마운트/애니메이션 지연 모두 허용
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  await user.click(screen.getByRole("button", { name: /회원가입/i }));
}

describe("PR-UI-05: SignupPageClient redirectTo 라우팅", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-02: mutateAsync가 redirectTo='/login'으로 응답하면 router.push('/login')가 1회 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/login" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("TC-03: mutateAsync가 임의의 redirectTo로 응답하면 router.push가 해당 경로로 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/custom-path" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/custom-path");
    });
  });

  it("TC-04: 프론트엔드는 redirectTo 값을 그대로 사용하며 경로를 추론하지 않는다", async () => {
    const redirectTo = "/arbitrary-route-456";
    mockMutateAsync.mockResolvedValue({ data: { redirectTo } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(redirectTo);
      expect(mockPush).not.toHaveBeenCalledWith("/resend-email");
      expect(mockPush).not.toHaveBeenCalledWith("/login");
    });
  });

  it("TC-05: 회원가입 성공 시 서버가 내려준 redirectTo로 이동한다", async () => {
    mockMutateAsync.mockResolvedValue({
      data: {
        redirectTo: "/verify-otp?purpose=signup&email=test%40example.com",
        email: "test@example.com",
      },
    });

    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        "/verify-otp?purpose=signup&email=test%40example.com",
      );
    });
  });
});

describe("SignupPageClient agreement_required 안내", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
    mockSearchParams.mockReturnValue(
      new URLSearchParams({ agreement_required: "1" }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("agreement_required=1이면 약관 동의 안내 toast를 표시한다", async () => {
    render(<SignupPageClient />);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "약관과 개인정보 처리방침 확인 및 동의가 필요합니다.",
        {
          variant: "destructive",
          dedupeKey: "auth-agreement-required",
        },
      );
    });
  });
});

describe("SignupPageClient OAuth callback 실패 안내", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        oauth_error: OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("oauth_error query가 있으면 소셜 로그인 실패 toast를 표시한다", async () => {
    render(<SignupPageClient />);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        OAUTH_CALLBACK_ERROR_TOAST_MESSAGE,
        {
          variant: "destructive",
          dedupeKey: OAUTH_CALLBACK_ERROR_TOAST_KEY,
        },
      );
    });
  });
});

describe("PR-UI-13: SignupPageClient submit → mutateAsync → redirectTo 연결", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: 유효한 폼 제출 시 mutateAsync가 정규화된 payload 형태로 정확히 1회 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/login" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          password: "password123",
          nickname: "tester",
          agreements: { termsOfService: true, privacyPolicy: true },
        }),
      );
    });
  });

  it("TC-02: mutateAsync가 redirectTo='/login'으로 응답하면 router.push('/login')가 1회 호출된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/login" } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("TC-03: mutateAsync가 임의의 redirectTo로 응답하면 router.push가 해당 경로로 호출된다", async () => {
    const redirectTo = "/custom-route";
    mockMutateAsync.mockResolvedValue({ data: { redirectTo } });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(redirectTo);
    });
  });

  it("TC-04: 프론트엔드는 data.redirectTo를 사용하여 라우팅한다", async () => {
    mockMutateAsync.mockResolvedValue({
      data: {
        email: "test@example.com",
        redirectTo: "/custom-route",
      },
    });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/custom-route");
      expect(mockPush).not.toHaveBeenCalledWith("/login");
    });
  });
});
