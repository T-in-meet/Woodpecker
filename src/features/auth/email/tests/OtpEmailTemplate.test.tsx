import { render } from "@react-email/render";
import React from "react";
import { describe, expect, it } from "vitest";

import { OTP_EXPIRES_IN_MINUTES } from "@/features/auth/constants/otp";
import { OtpEmailTemplate } from "@/features/auth/email/OtpEmailTemplate";
import { LEGAL_CONTACT } from "@/lib/constants/legal";

function removeReactTextMarkers(html: string) {
  return html.replaceAll("<!-- -->", "");
}

describe("OtpEmailTemplate", () => {
  const otp = "123456";

  it("signup 목적의 인증 내용을 렌더링한다.", async () => {
    const html = await render(
      React.createElement(OtpEmailTemplate, {
        otp,
        purpose: "signup",
      }),
    );

    expect(html).toContain("이메일 인증을 완료해주세요");
    expect(html).toContain(
      "딱다구리 회원가입을 계속하려면 아래 인증 번호를 입력해주세요.",
    );
    expect(html).toContain(
      "본인이 회원가입을 요청하지 않았다면 이 메일을 무시해주세요.",
    );
  });

  it("reset-password 목적의 인증 내용을 렌더링한다.", async () => {
    const html = await render(
      React.createElement(OtpEmailTemplate, {
        otp,
        purpose: "reset-password",
      }),
    );

    expect(html).toContain("비밀번호 재설정 인증 번호");
    expect(html).toContain(
      "딱다구리 비밀번호를 재설정하려면 아래 인증 번호를 입력해주세요.",
    );
    expect(html).toContain(
      "본인이 비밀번호 재설정을 요청하지 않았다면 이 메일을 무시해주세요.",
    );
  });

  it("OTP와 만료 시간을 렌더링한다.", async () => {
    const html = await render(
      React.createElement(OtpEmailTemplate, {
        otp,
        purpose: "signup",
      }),
    );
    const normalizedHtml = removeReactTextMarkers(html);

    expect(normalizedHtml).toContain(otp);
    expect(normalizedHtml).toContain(
      `인증 번호는 ${OTP_EXPIRES_IN_MINUTES}분 동안 유효합니다.`,
    );
  });

  it("문의 이메일과 mailto 링크를 렌더링한다.", async () => {
    const html = await render(
      React.createElement(OtpEmailTemplate, {
        otp,
        purpose: "signup",
      }),
    );

    expect(html).toContain(LEGAL_CONTACT.email);
    expect(html).toContain(`mailto:${LEGAL_CONTACT.email}`);
  });

  it("이메일용 PNG 로고를 사용한다.", async () => {
    const html = await render(
      React.createElement(OtpEmailTemplate, {
        otp,
        purpose: "signup",
      }),
    );

    expect(html).toContain("/icons/notification-192.png");
    expect(html).toContain('alt="딱다구리"');
  });
});
