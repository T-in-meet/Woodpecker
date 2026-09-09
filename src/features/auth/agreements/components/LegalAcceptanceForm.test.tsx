import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AcceptLegalDocumentsState } from "@/features/auth/agreements/actions/acceptLegalDocumentsAction";
import { LegalAcceptanceForm } from "@/features/auth/agreements/components/LegalAcceptanceForm";

const useActionStateMock = vi.hoisted(() => vi.fn());
const formActionMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

const action = vi.fn(
  async (
    _state: AcceptLegalDocumentsState,
    _formData: FormData,
  ): Promise<AcceptLegalDocumentsState> => ({}),
);

function renderForm({
  state = {},
  isPending = false,
  isEnforced = false,
}: {
  state?: AcceptLegalDocumentsState;
  isPending?: boolean;
  isEnforced?: boolean;
} = {}) {
  useActionStateMock.mockReturnValue([state, formActionMock, isPending]);

  return render(
    <LegalAcceptanceForm action={action} isEnforced={isEnforced} />,
  );
}

async function checkAllAgreements() {
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("checkbox", {
      name: /이용약관/,
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: /개인정보 처리방침/,
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: /만 14세 이상/,
    }),
  );

  return user;
}

describe("LegalAcceptanceForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("세 확인 항목과 비활성화된 제출 버튼을 렌더링한다", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { name: "법적 문서 확인" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("checkbox", { name: /이용약관/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /개인정보 처리방침/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /만 14세 이상/ }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "확인하고 계속하기" }),
    ).toBeDisabled();
  });

  it("세 항목을 모두 체크한 경우에만 제출 버튼을 활성화한다", async () => {
    const user = userEvent.setup();

    renderForm();

    const submitButton = screen.getByRole("button", {
      name: "확인하고 계속하기",
    });

    const termsCheckbox = screen.getByRole("checkbox", {
      name: /이용약관/,
    });
    const privacyCheckbox = screen.getByRole("checkbox", {
      name: /개인정보 처리방침/,
    });
    const ageCheckbox = screen.getByRole("checkbox", {
      name: /만 14세 이상/,
    });

    expect(submitButton).toBeDisabled();

    await user.click(termsCheckbox);
    expect(submitButton).toBeDisabled();

    await user.click(privacyCheckbox);
    expect(submitButton).toBeDisabled();

    await user.click(ageCheckbox);
    expect(submitButton).toBeEnabled();
  });

  it("모두 체크한 뒤 하나를 해제하면 제출 버튼을 다시 비활성화한다", async () => {
    renderForm();

    const user = await checkAllAgreements();

    const submitButton = screen.getByRole("button", {
      name: "확인하고 계속하기",
    });

    expect(submitButton).toBeEnabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /이용약관/,
      }),
    );

    expect(submitButton).toBeDisabled();
  });

  it("Server Action 에러를 공통 에러 영역에 표시한다", () => {
    const errorMessage = "확인 기록을 저장하지 못했습니다. 다시 시도해주세요.";

    renderForm({
      state: {
        error: errorMessage,
      },
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("pending 상태에서는 저장 중 문구를 표시하고 버튼을 비활성화한다", async () => {
    renderForm({ isPending: true });

    const user = userEvent.setup();

    await user.click(
      screen.getByRole("checkbox", {
        name: /이용약관/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /개인정보 처리방침/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /만 14세 이상/,
      }),
    );

    expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled();
  });

  it("세 항목을 모두 체크하고 제출하면 FormData에 각 확인 값을 전달한다", async () => {
    renderForm();

    const user = await checkAllAgreements();

    const submitButton = screen.getByRole("button", {
      name: "확인하고 계속하기",
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(formActionMock).toHaveBeenCalledTimes(1);
    });

    const formData = formActionMock.mock.calls[0]?.[0];

    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get("termsOfService")).toBe("on");
    expect((formData as FormData).get("privacyPolicyAcknowledged")).toBe("on");
    expect((formData as FormData).get("age14OrOlder")).toBe("on");
  });

  it("시행 전에는 미리 동의할 수 있다는 안내를 표시한다", () => {
    renderForm({ isEnforced: false });

    expect(
      screen.getByText(/시행 전에 미리 확인하고 동의할 수 있습니다/),
    ).toBeInTheDocument();
  });

  it("시행 후에는 계속 이용을 위해 확인이 필요하다는 안내를 표시한다", () => {
    renderForm({ isEnforced: true });

    expect(
      screen.getByText(/계속 이용하려면 아래 항목을 완료해주세요/),
    ).toBeInTheDocument();
  });
});
