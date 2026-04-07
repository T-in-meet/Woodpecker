/**
 * sendAuthEmail - 이메일 발송 통합 함수 테스트
 *
 * 검증 범위:
 * - 콜백 링크 생성: ${APP_URL}/auth/callback?ticket=${ticket}
 * - React Email 템플릿 렌더링 호출
 * - Resend를 통한 이메일 전송
 * - 외부 서비스 실패 시 에러 전파
 *
 * mock 대상:
 * - @react-email/render: render 함수 (HTML 반환 제어)
 * - @/lib/resend: resend 클라이언트 (전송 호출 추적)
 * - @/features/auth/email/AuthEmailTemplate: React Email 컴포넌트
 */

import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { resend } from "@/lib/resend";

vi.mock("@react-email/render");
vi.mock("@/lib/resend", () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
}));
vi.mock("@/features/auth/email/AuthEmailTemplate");

const TEST_EMAIL = "user@example.com";
const TEST_TICKET = "encrypted-ticket-xyz";
const TEST_HTML = "<html><body>Test Email</body></html>";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["APP_URL"] = "http://localhost:3000";
  vi.mocked(render).mockResolvedValue(TEST_HTML);
  vi.mocked(resend.emails.send).mockResolvedValue({
    data: { id: "msg-id" },
    error: null,
    headers: null,
  });
});

describe("sendAuthEmail - 이메일 발송 핵심 흐름", () => {
  it("TC-01. AuthEmailTemplate에 APP_URL/auth/callback?ticket=<ticket> 형태의 link가 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(render)).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          link: `http://localhost:3000/auth/callback?ticket=${TEST_TICKET}`,
        }),
      }),
    );
  });

  it("TC-02. render()가 정확히 1회 호출된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(render)).toHaveBeenCalledTimes(1);
  });

  it("TC-03. render() 결과 HTML이 resend.emails.send의 html 필드로 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledWith(
      expect.objectContaining({ html: TEST_HTML }),
    );
  });

  it("TC-04. resend.emails.send에 올바른 to 이메일이 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: TEST_EMAIL }),
    );
  });

  it("TC-05. resend.emails.send가 정확히 1회 호출된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledTimes(1);
  });

  it("TC-06. resend.emails.send가 error를 반환하면 throw한다", async () => {
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: {
        message: "API rate limit exceeded",
        name: "rate_limit_exceeded",
        statusCode: 429,
      },
      headers: null,
    });

    await expect(
      sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email"),
    ).rejects.toThrow();
  });

  it("TC-07. render()가 실패하면 에러를 throw한다", async () => {
    vi.mocked(render).mockRejectedValue(new Error("Render failed"));

    await expect(
      sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email"),
    ).rejects.toThrow("Render failed");
  });

  it("TC-08. APP_URL이 없으면 에러를 throw한다", async () => {
    delete process.env["APP_URL"];

    await expect(
      sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email"),
    ).rejects.toThrow("APP_URL is not set");
  });
});
