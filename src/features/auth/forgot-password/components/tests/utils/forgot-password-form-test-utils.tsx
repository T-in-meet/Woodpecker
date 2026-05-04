import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { vi } from "vitest";

import { ForgotPasswordActionState } from "@/features/auth/forgot-password/actions/forgotPasswordActionState";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/ForgotPasswordForm";
import { FORGOT_PASSWORD_LABEL_MESSAGES } from "@/features/auth/forgot-password/constants/messages";
import { showToast } from "@/lib/utils/showToast";

type ForgotPasswordFormActionState =
  | { status: "idle"; fieldErrors: null }
  | { status: "completed"; fieldErrors: null }
  | { status: "blocked"; fieldErrors: null }
  | { status: "internal_error"; fieldErrors: null }
  | { status: "invalid_input"; fieldErrors: { email?: string[] } };

type UseActionStateMockReturn = [
  ForgotPasswordFormActionState,
  ReturnType<typeof vi.fn>,
  boolean,
];

const hoisted = vi.hoisted(() => {
  const formActionMock = vi.fn();
  const prefillStore = { email: null as string | null };
  const searchParamsStore = { error: null as string | null };

  return {
    formActionMock,
    useActionStateMock: vi.fn<() => UseActionStateMockReturn>(() => [
      { status: "idle", fieldErrors: null },
      formActionMock,
      false,
    ]),
    prefillStore,
    searchParamsStore,
    deferred: null as null | {
      promise: Promise<unknown>;
      resolve: (value?: unknown) => void;
      reject: (reason?: unknown) => void;
    },
  };
});

// query.error 시나리오를 테스트에서 제어하기 위해 useSearchParams를 고정 mock한다.
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: (key: string) =>
      key === "error" ? hoisted.searchParamsStore.error : null,
  })),
}));

// form 테스트는 useActionState tuple(state, formAction, isPending)을 파일 단위로 제어한다.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: hoisted.useActionStateMock,
  };
});

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

vi.mock(
  "@/features/auth/forgot-password/lib/forgotPasswordPrefillMemory",
  () => ({
    consumeForgotPasswordPrefillEmail: vi.fn(() => {
      const email = hoisted.prefillStore.email;
      hoisted.prefillStore.email = null;
      return email;
    }),
  }),
);

const mockAction = vi.fn(
  async (
    _prevState: ForgotPasswordActionState,
    _formData: FormData,
  ): Promise<ForgotPasswordActionState> => ({
    status: "idle",
    fieldErrors: null,
  }),
);

type ForgotPasswordState =
  | { status: "idle"; fieldErrors: null }
  | { status: "completed"; fieldErrors: null }
  | { status: "invalid_input"; fieldErrors: { email?: string[] } }
  | { status: "blocked"; fieldErrors: null }
  | { status: "internal_error"; fieldErrors: null };

type SetupOptions = {
  state?: ForgotPasswordState;
  isPending?: boolean;
  prefillEmail?: string | null;
  queryError?: string | null;
};

export const FIXTURES = {
  valid: "user@example.com",
  validWithSpaces: "  user@example.com  ",
  invalid: "invalid-email",
  empty: "",
  prefillValid: "prefill@example.com",
  prefillInvalid: "invalid-email",
} as const;

export function setupForgotPasswordFormTest(options: SetupOptions = {}) {
  const { state, isPending, prefillEmail = null, queryError = null } = options;

  hoisted.deferred = null;
  hoisted.prefillStore.email = prefillEmail;
  hoisted.searchParamsStore.error = queryError;
  hoisted.formActionMock.mockReset();

  const resolvedIsPending = typeof isPending === "boolean" ? isPending : false;

  hoisted.useActionStateMock.mockReturnValue([
    state ?? { status: "idle", fieldErrors: null },
    hoisted.formActionMock,
    resolvedIsPending,
  ]);
}

export function setPendingWithDeferredPromise() {
  let resolve: (value?: unknown) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // resolve/reject 제어가 가능한 pending Promise로 로딩 상태를 재현한다.
  hoisted.deferred = { promise, resolve, reject };
  hoisted.formActionMock.mockImplementation(() => promise);
  hoisted.useActionStateMock.mockReturnValue([
    { status: "idle", fieldErrors: null },
    hoisted.formActionMock,
    true,
  ]);
}

export function setFormActionRejectOnce() {
  hoisted.formActionMock.mockRejectedValueOnce(new Error("action failed"));
}

export function resetToastMock() {
  vi.mocked(showToast).mockReset();
}

export function renderForgotPasswordForm(
  _options?: Partial<ComponentProps<typeof ForgotPasswordForm>>,
) {
  return render(<ForgotPasswordForm action={mockAction} />);
}

export function rerenderForgotPasswordForm(rerender: (ui: ReactNode) => void) {
  rerender(<ForgotPasswordForm action={mockAction} />);
}

export function getEmailInput() {
  return screen.getByRole("textbox", { name: /이메일/i });
}

export function getSubmitButtonByDefaultLabel() {
  return screen.getByRole("button", {
    name: FORGOT_PASSWORD_LABEL_MESSAGES.submit,
  });
}

export function getSubmitButtonByLoadingLabel() {
  return screen.getByRole("button", {
    name: FORGOT_PASSWORD_LABEL_MESSAGES.loading,
  });
}

export async function typeValidEmail() {
  fireEvent.change(getEmailInput(), { target: { value: FIXTURES.valid } });
}

export async function typeInvalidEmail() {
  fireEvent.change(getEmailInput(), { target: { value: FIXTURES.invalid } });
}

export async function typeEmail(value: string) {
  fireEvent.change(getEmailInput(), { target: { value } });
}

export async function submitForm() {
  // 초기/로딩 문구 모두 허용해 버튼 query를 고정한다.
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(
        `${FORGOT_PASSWORD_LABEL_MESSAGES.submit}|${FORGOT_PASSWORD_LABEL_MESSAGES.loading}`,
      ),
    }),
  );
}

export function submitByFormEvent() {
  fireEvent.submit(getEmailInput().closest("form")!);
}

export function submitWithEnterKey() {
  const input = getEmailInput();
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  fireEvent.submit(input.closest("form")!);
}

export function getFormActionMock() {
  return hoisted.formActionMock;
}
