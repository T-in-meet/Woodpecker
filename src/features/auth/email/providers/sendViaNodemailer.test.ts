import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendViaNodemailer } from "./sendViaNodemailer";

const { mockCreateTransport, mockRequireFromEsm, mockSendMail } = vi.hoisted(
  () => ({
    mockCreateTransport: vi.fn(),
    mockRequireFromEsm: vi.fn(),
    mockSendMail: vi.fn(),
  }),
);

vi.mock("node:module", () => ({
  createRequire: () => mockRequireFromEsm,
}));

describe("sendViaNodemailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "test@example.com");
    vi.stubEnv("SMTP_PASS", "app-password");

    mockRequireFromEsm.mockReturnValue({
      createTransport: mockCreateTransport,
    });
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    });
    mockSendMail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("확정된 SMTP timeout과 기존 전송 설정을 transporter에 전달한다", async () => {
    const payload = {
      from: "Woodpecker <no-reply@example.com>",
      to: "user@example.com",
      subject: "인증 번호",
      html: "<p>123456</p>",
    };

    await sendViaNodemailer(payload);

    expect(mockRequireFromEsm).toHaveBeenCalledWith("nodemailer");
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "test@example.com",
        pass: "app-password",
      },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      dnsTimeout: 10_000,
      socketTimeout: 15_000,
    });
    expect(mockSendMail).toHaveBeenCalledWith(payload);
  });
});
