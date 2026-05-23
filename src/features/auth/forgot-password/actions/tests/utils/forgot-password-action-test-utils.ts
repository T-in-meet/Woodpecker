import { afterEach, beforeEach, expect, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { resetEligibilityStore } from "@/features/auth/lib/requestEligibilityStore";

import {
  ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "../../forgotPasswordActionState";

/**
 * forgot-password action에서 "최종 종료 상태"로 간주하는 이벤트 목록
 *
 * 목적:
 * - action이 정상 종료되었는지 검증
 * - 중복 terminal event 발생 여부 검증
 * - 요청 로그 이후 정확히 1개의 종료 로그만 남는지 검증
 *
 * terminal event 예시:
 * - completed
 * - invalid_input
 * - rate_limited
 * - failed
 */
export const FORGOT_PASSWORD_TERMINAL_EVENTS = [
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
] as const;

type TerminalEvent = (typeof FORGOT_PASSWORD_TERMINAL_EVENTS)[number];

/**
 * logAuthEvent / logAuthError 호출 중
 * terminal event에 해당하는 호출만 추출한다.
 *
 * 사용하는 이유:
 * - 요청 로그(logRequested)는 제외
 * - 중간 디버그 이벤트 제외
 * - 최종 종료 이벤트만 검증하기 위함
 */
export function getTerminalEventCalls(
  mocks: ReturnType<typeof setupActionTest>,
) {
  return [
    ...mocks.logAuthEventMock.mock.calls,
    ...mocks.logAuthErrorMock.mock.calls,
  ].filter(([event]) =>
    FORGOT_PASSWORD_TERMINAL_EVENTS.includes(event as TerminalEvent),
  );
}

/**
 * terminal event가 정확히 1번만 발생했는지 검증한다.
 *
 * 검증 목적:
 * - completed + failed 중복 발생 방지
 * - invalid_input 이후 추가 에러 로그 발생 방지
 * - action 종료 계약(contract) 보장
 */
export function expectExactlyOneTerminalEvent(
  mocks: ReturnType<typeof setupActionTest>,
  expected: TerminalEvent,
) {
  const calls = getTerminalEventCalls(mocks);

  expect(calls).toHaveLength(1);
  expect(calls[0]?.[0]).toBe(expected);
}

/**
 * 요청 로그(logRequested)가
 * terminal event보다 먼저 호출되었는지 검증한다.
 *
 * 검증 이유:
 * - 모든 요청은 시작 로그를 먼저 남겨야 함
 * - 실패하더라도 요청 자체는 기록되어야 함
 * - 로깅 순서 계약 검증
 */
export function expectRequestedBeforeTerminalEvent(
  mocks: ReturnType<typeof setupActionTest>,
) {
  const requestedOrder = mocks.logRequestedMock.mock.invocationCallOrder[0];

  const terminalOrders = [
    ...mocks.logAuthEventMock.mock.invocationCallOrder,
    ...mocks.logAuthErrorMock.mock.invocationCallOrder,
  ];

  expect(requestedOrder).toBeDefined();
  expect(terminalOrders.length).toBeGreaterThan(0);
  expect(Math.min(...terminalOrders)).toBeGreaterThan(requestedOrder!);
}

/**
 * 과거 action 응답 구조(code/success/data)가
 * 남아있지 않은지 검증한다.
 *
 * 사용하는 이유:
 * - 상태 기반 action 구조로 전환됨
 * - 레거시 API 응답 구조 제거 검증
 * - 테스트 계약 회귀 방지
 */
export function expectNoLegacyActionFields(state: Record<string, unknown>) {
  expect(state).not.toHaveProperty("code");
  expect(state).not.toHaveProperty("success");
  expect(state).not.toHaveProperty("data");
}

/**
 * vi.mock은 파일 최상단에서 hoist되기 때문에
 * mock 함수 참조를 안전하게 공유하기 위해 hoisted 사용
 *
 * 사용하는 이유:
 * - mock 초기화 순서 문제 방지
 * - 테스트마다 동일 mock 인스턴스 재사용
 * - vi.mock 내부에서 외부 변수 접근 가능하게 함
 */
const hoisted = vi.hoisted(() => ({
  issueOtpAndSendEmailMock: vi.fn(),
  redirectMock: vi.fn(),
  getServerActionClientIp: vi.fn(),
  applyMinimumActionDelay: vi.fn(),
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
}));

/**
 * next/navigation redirect mock
 *
 * 실제 next redirect는 throw 기반 동작이므로
 * 테스트에서도 동일하게 NEXT_REDIRECT 에러를 발생시킨다.
 */
vi.mock("next/navigation", () => ({
  redirect: hoisted.redirectMock,
}));

/**
 * OTP 발급 + 이메일 발송 함수 mock
 *
 * 사용하는 이유:
 * - 실제 이메일 발송 차단
 * - 성공/실패 흐름 제어
 * - 외부 의존성 제거
 */
vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmail: hoisted.issueOtpAndSendEmailMock,
}));

/**
 * 서버 액션 IP 추출 mock
 *
 * 사용하는 이유:
 * - rate limit 테스트 제어
 * - 로그 검증 안정화
 * - 테스트 환경에서 고정 IP 사용
 */
vi.mock("@/lib/utils/getServerActionClientIp", () => ({
  getServerActionClientIp: hoisted.getServerActionClientIp,
}));

/**
 * 최소 응답 시간 보정 mock
 *
 * 사용하는 이유:
 * - timing attack 방어 로직 유지
 * - 테스트 속도 저하 방지
 */
vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: hoisted.applyMinimumActionDelay,
}));

/**
 * auth logger mock
 *
 * normalizeUnknownError까지 mock하는 이유:
 * - logger 내부 구현 의존 제거
 * - 에러 직렬화 안정화
 * - 테스트 중 unknown error 처리 보장
 */
vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: hoisted.logRequested,
  logAuthEvent: hoisted.logAuthEvent,
  logAuthError: hoisted.logAuthError,
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

/**
 * OTP 발급 mock 동작 모드
 *
 * success:
 * - 정상 이메일 발송 흐름
 *
 * throw:
 * - 내부 에러 흐름 검증
 */
export type IssueOtpAndSendEmailMode = "success" | "throw";

/**
 * 테스트 환경 구성 옵션
 */
export type ForgotPasswordActionTestOptions = {
  email?: string;
  redirect?: string | null;
  ip?: string;
  issueOtpAndSendEmail?: IssueOtpAndSendEmailMode;
};

/**
 * 서버 액션용 FormData 생성 헬퍼
 *
 * 사용하는 이유:
 * - 실제 form submit 구조와 동일하게 테스트
 * - action input 구조 통일
 */
export function makeFormData(input: { email: string }) {
  const formData = new FormData();
  formData.set("email", input.email);
  return formData;
}

/**
 * issueOtpAndSendEmail mock 동작 설정
 *
 * success:
 * - 정상 완료
 *
 * throw:
 * - 내부 예외 발생
 */
function mockIssueOtpAndSendEmail(mode: IssueOtpAndSendEmailMode) {
  if (mode === "success") {
    hoisted.issueOtpAndSendEmailMock.mockResolvedValue(undefined);
    return;
  }

  hoisted.issueOtpAndSendEmailMock.mockRejectedValue(
    new Error("unexpected error"),
  );
}

/**
 * verify-otp 이동 URL 생성 헬퍼
 *
 * 사용하는 이유:
 * - redirect URL 생성 로직 중복 제거
 * - query encoding 일관성 유지
 * - 테스트 기대값 통일
 */
export function buildVerifyOtpUrl(input: {
  email: string;
  redirect?: string | null;
}) {
  const params = new URLSearchParams({
    purpose: "reset-password",
    email: input.email.trim(),
  });

  if (input.redirect) {
    params.set("redirect", input.redirect);
  }

  return `/verify-otp?${params.toString()}`;
}

/**
 * 테스트 중 변경한 환경 변수 복원을 위한 저장소
 */
let originalAppUrl: string | undefined;
let originalAuthEmailFrom: string | undefined;

/**
 * 테스트용 환경 변수 설정
 *
 * 사용하는 이유:
 * - APP_URL 의존 제거
 * - 이메일 발신자 고정
 * - 테스트 환경 안정화
 */
beforeEach(() => {
  originalAppUrl = process.env.APP_URL;
  originalAuthEmailFrom = process.env.AUTH_EMAIL_FROM;

  process.env.APP_URL = "https://example.com";
  process.env.AUTH_EMAIL_FROM = "no-reply@example.com";
});

/**
 * 테스트 종료 후 환경 변수 원복
 *
 * 사용하는 이유:
 * - 테스트 간 환경 오염 방지
 * - 다른 테스트와 격리 유지
 */
afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }

  if (originalAuthEmailFrom === undefined) {
    delete process.env.AUTH_EMAIL_FROM;
  } else {
    process.env.AUTH_EMAIL_FROM = originalAuthEmailFrom;
  }
});

/**
 * forgotPasswordAction 테스트 환경 생성 함수
 *
 * 역할:
 * - mock 초기화
 * - eligibility store 초기화
 * - redirect mock 설정
 * - action 실행 함수 제공
 */
export function setupActionTest(options: ForgotPasswordActionTestOptions = {}) {
  vi.clearAllMocks();

  /**
   * rate limit / eligibility 상태 초기화
   *
   * 사용하는 이유:
   * - 이전 테스트 상태 누수 방지
   */
  resetEligibilityStore();

  /**
   * Next.js redirect 동작 모사
   *
   * 실제 redirect는 throw 기반 동작이므로
   * 테스트에서도 동일하게 처리
   */
  hoisted.redirectMock.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });

  const email = options.email ?? "user@example.com";

  mockIssueOtpAndSendEmail(options.issueOtpAndSendEmail ?? "success");

  /**
   * 기본 테스트 IP 설정
   */
  hoisted.getServerActionClientIp.mockResolvedValue(
    options.ip ?? "203.0.113.10",
  );

  /**
   * 최소 응답 시간 mock
   */
  hoisted.applyMinimumActionDelay.mockResolvedValue(undefined);

  /**
   * 실제 action 호출 헬퍼
   *
   * override를 통해
   * 테스트마다 email / redirect 교체 가능
   */
  async function callAction(override?: {
    email?: string;
    redirect?: string | null;
  }) {
    const mod = await import("../../forgotPasswordAction");

    return mod.forgotPasswordAction(
      override?.redirect ?? options.redirect ?? null,
      INITIAL_FORGOT_PASSWORD_ACTION_STATE,
      makeFormData({ email: override?.email ?? email }),
    );
  }

  return {
    callAction,
    issueOtpAndSendEmailMock: hoisted.issueOtpAndSendEmailMock,
    redirectMock: hoisted.redirectMock,
    applyMinimumActionDelayMock: hoisted.applyMinimumActionDelay,
    logRequestedMock: hoisted.logRequested,
    logAuthEventMock: hoisted.logAuthEvent,
    logAuthErrorMock: hoisted.logAuthError,
    getServerActionClientIp: hoisted.getServerActionClientIp,
  };
}

/**
 * action state 기본 구조 검증
 *
 * 사용하는 이유:
 * - 상태 기반 action 구조 유지 검증
 * - 레거시 API 응답 구조 회귀 방지
 */
export function expectActionStateShape(state: unknown) {
  const typed = state as ForgotPasswordActionState;

  expect(typed).toHaveProperty("status");
  expect(typed).toHaveProperty("fieldErrors");

  expect(typed).not.toHaveProperty("code");
  expect(typed).not.toHaveProperty("success");
  expect(typed).not.toHaveProperty("data");
}

/**
 * terminal event 개수 반환
 *
 * 사용하는 이유:
 * - 중복 종료 이벤트 검증
 * - completed + failed 동시 발생 방지
 */
export function getTerminalEventCallCount(
  mocks: ReturnType<typeof setupActionTest>,
) {
  return getTerminalEventCalls(mocks).length;
}
