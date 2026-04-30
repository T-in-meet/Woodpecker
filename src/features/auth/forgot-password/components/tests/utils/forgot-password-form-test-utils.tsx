import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { vi } from "vitest";

import { showToast } from "@/lib/utils/showToast";

type ForgotPasswordFormActionState =
  | { status: "idle"; fieldErrors: null }
  | { status: "success"; fieldErrors: null }
  | { status: "global_error"; fieldErrors: null }
  | { status: "field_error"; fieldErrors: { email?: string[] } };

type UseActionStateMockReturn = [
  ForgotPasswordFormActionState,
  ReturnType<typeof vi.fn>,
  boolean,
];

const hoisted = vi.hoisted(() => {
  const formActionMock = vi.fn();
  const safeParseMock = vi.fn();
  const prefillStore = { email: null as string | null };
  const searchParamsStore = { error: null as string | null };

  return {
    formActionMock,
    safeParseMock,
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
  "@/features/auth/forgot-password/schemas/forgotPasswordFormSchema",
  () => ({
    forgotPasswordFormSchema: {
      safeParse: hoisted.safeParseMock,
    },
  }),
);

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

import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/ForgotPasswordForm";

type ForgotPasswordState =
  | { status: "idle"; fieldErrors: null }
  | { status: "success"; fieldErrors: null }
  | { status: "field_error"; fieldErrors: { email?: string[] } }
  | { status: "global_error"; fieldErrors: null };

type SetupOptions = {
  state?: ForgotPasswordState;
  isPending?: boolean;
  prefillEmail?: string | null;
  queryError?: string | null;
};

export const FIXTURES = {
  valid: "user@example.com",
  invalid: "invalid-email",
  empty: "",
  prefillValid: "prefill@example.com",
  prefillInvalid: "invalid-email",
} as const;

export const MESSAGES = {
  required: "이메일을 입력해주세요.",
  invalidFormat: "올바른 이메일 형식으로 입력해주세요.",
  success: "가입된 이메일이라면 비밀번호 재설정 메일을 받을 수 있습니다.",
  globalError: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
  submit: "비밀번호 재설정 메일 받기",
  loading: "전송 중...",
  invalidResetLink:
    "비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.",
} as const;

export function setDefaultValidSafeParse() {
  hoisted.safeParseMock.mockReturnValue({
    success: true,
    data: { email: FIXTURES.valid },
  });
}

export function setInvalidSafeParse(message: string) {
  hoisted.safeParseMock.mockReturnValue({
    success: false,
    error: {
      flatten: () => ({
        formErrors: [],
        fieldErrors: { email: [message] },
      }),
    },
  });
}

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
  return render(<ForgotPasswordForm />);
}

export function rerenderForgotPasswordForm(rerender: (ui: ReactNode) => void) {
  rerender(<ForgotPasswordForm />);
}

export function getEmailInput() {
  return screen.getByRole("textbox", { name: /이메일/i });
}

export function getSubmitButtonByDefaultLabel() {
  return screen.getByRole("button", { name: MESSAGES.submit });
}

export function getSubmitButtonByLoadingLabel() {
  return screen.getByRole("button", { name: MESSAGES.loading });
}

export async function typeValidEmail() {
  fireEvent.change(getEmailInput(), { target: { value: FIXTURES.valid } });
}

export async function typeInvalidEmail() {
  fireEvent.change(getEmailInput(), { target: { value: FIXTURES.invalid } });
}

export async function submitForm() {
  // 초기/로딩 문구 모두 허용해 버튼 query를 고정한다.
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(`${MESSAGES.submit}|${MESSAGES.loading}`),
    }),
  );
}

export function submitByFormEvent() {
  fireEvent.submit(getEmailInput().closest("form")!);
}

export function submitWithEnterKey() {
  fireEvent.keyDown(getEmailInput(), { key: "Enter", code: "Enter" });
}

export function getFormActionMock() {
  return hoisted.formActionMock;
}

export function getSafeParseMock() {
  return hoisted.safeParseMock;
}
