import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignupPageClient from "@/features/auth/signup/components/SignupPageClient";

const mockPush = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("@/features/auth/signup/hooks/useSignupMutation", () => ({
  useSignupMutation: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

async function submitValidSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
  await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
  await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
  await user.type(screen.getByLabelText(/닉네임/i), "tester");
  // interactionEnabled=false 상태에서 체크박스 클릭이 모달을 열므로 모달 경유
  // 이유: agreement-interaction-control-spec에서 모달-먼저 상호작용 강제
  await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));
  const termsDialog = await screen.findByRole("dialog");
  await user.click(
    within(termsDialog).getByRole("button", { name: /Agree and continue/i }),
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
    within(privacyDialog).getByRole("button", { name: /Agree and continue/i }),
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
      expect(mockPush).not.toHaveBeenCalledWith("/verify-email");
      expect(mockPush).not.toHaveBeenCalledWith("/login");
    });
  });

  it("TC-05: redirectTo가 '/verify-email'이면 email query를 포함해 이동한다", async () => {
    mockMutateAsync.mockResolvedValue({
      data: {
        redirectTo: "/verify-email",
        email: "test@example.com",
      },
    });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await submitValidSignupForm(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        "/verify-email?email=test%40example.com",
      );
    });
  });
});

describe("PR-UI-13: SignupPageClient submit → mutateAsync → redirectTo 연결", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockMutateAsync.mockReset();
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

  it("TC-05: 폼에 avatarFile이 포함되면 mutateAsync payload에 avatarFile이 전달된다", async () => {
    mockMutateAsync.mockResolvedValue({ data: { redirectTo: "/login" } });
    const avatarFile = new File(["content"], "avatar.jpg", {
      type: "image/jpeg",
    });
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
    await user.type(screen.getByLabelText(/^비밀번호$/i), "password123");
    await user.type(screen.getByLabelText(/비밀번호 확인/i), "password123");
    await user.type(screen.getByLabelText(/닉네임/i), "tester");
    await user.upload(screen.getByLabelText(/프로필 사진/i), avatarFile);
    // interactionEnabled=false 상태에서 체크박스 클릭이 모달을 열므로 모달 경유
    // 이유: agreement-interaction-control-spec에서 모달-먼저 상호작용 강제
    await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));
    const termsDialog = await screen.findByRole("dialog");
    await user.click(
      within(termsDialog).getByRole("button", { name: /Agree and continue/i }),
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
      within(privacyDialog).getByRole("button", {
        name: /Agree and continue/i,
      }),
    );
    // 즉시 언마운트/애니메이션 지연 모두 허용
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarFile: expect.any(File),
        }),
      );
    });
  });
});
