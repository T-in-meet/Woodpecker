/**
 * sendAuthEmail - 이메일 발송 통합 함수 테스트
 *
 * 검증 범위:
 * - 콜백 링크 생성: ${APP_URL}/api/auth/callback?ticket=${ticket}
 * - React Email 템플릿 렌더링 호출
 * - nodemailer provider 호출(현 정책: 전 환경 nodemailer 고정)
 * - 외부 서비스 실패 시 에러 전파
 *
 * mock 대상:
 * - @react-email/render: render 함수 (HTML 반환 제어)
 * - @/features/auth/email/providers/sendViaNodemailer: nodemailer 전송 함수
 * - @/features/auth/email/providers/sendViaResend: fallback 미호출 검증용
 * - @/features/auth/email/AuthEmailTemplate: React Email 컴포넌트
 */

import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendViaNodemailer } from "@/features/auth/email/providers/sendViaNodemailer";
import { sendViaResend } from "@/features/auth/email/providers/sendViaResend";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";

vi.mock("@react-email/render");
vi.mock("@/features/auth/email/providers/sendViaNodemailer", () => ({
  sendViaNodemailer: vi.fn(),
}));
vi.mock("@/features/auth/email/providers/sendViaResend", () => ({
  sendViaResend: vi.fn(),
}));
vi.mock("@/features/auth/email/AuthEmailTemplate");

const TEST_EMAIL = "user@example.com";
const TEST_TICKET = "encrypted-ticket-xyz";
const TEST_HTML = "<html><body>Test Email</body></html>";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["APP_URL"] = "http://localhost:3000";
  process.env["AUTH_EMAIL_FROM"] = "noreply@example.com";
  vi.mocked(render).mockResolvedValue(TEST_HTML);
  vi.mocked(sendViaNodemailer).mockResolvedValue();
  vi.mocked(sendViaResend).mockResolvedValue();
});

describe("sendAuthEmail - 이메일 발송 핵심 흐름", () => {
  it("TC-01. AuthEmailTemplate에 APP_URL/api/auth/callback?ticket=<ticket> 형태의 link가 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(render)).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          link: `http://localhost:3000/api/auth/callback?ticket=${TEST_TICKET}`,
        }),
      }),
    );
  });

  it("TC-02. render()가 정확히 1회 호출된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(render)).toHaveBeenCalledTimes(1);
  });

  it("TC-03. render() 결과 HTML이 sendViaNodemailer의 html 필드로 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(sendViaNodemailer)).toHaveBeenCalledWith(
      expect.objectContaining({ html: TEST_HTML }),
    );
  });

  it("TC-04. sendViaNodemailer에 올바른 to 이메일이 전달된다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(sendViaNodemailer)).toHaveBeenCalledWith(
      expect.objectContaining({ to: TEST_EMAIL }),
    );
  });

  it("TC-05. sendViaNodemailer가 정확히 1회 호출되고 resend는 호출되지 않는다", async () => {
    await sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email");

    expect(vi.mocked(sendViaNodemailer)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendViaResend)).not.toHaveBeenCalled();
  });

  it("TC-06. sendViaNodemailer가 실패하면 throw한다", async () => {
    vi.mocked(sendViaNodemailer).mockRejectedValue(
      new Error("SMTP authentication failed"),
    );

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

  it("TC-09. AUTH_EMAIL_FROM이 없으면 에러를 throw한다", async () => {
    delete process.env["AUTH_EMAIL_FROM"];

    await expect(
      sendAuthEmail(TEST_EMAIL, TEST_TICKET, "verify-email"),
    ).rejects.toThrow("AUTH_EMAIL_FROM is not set");
  });
});
