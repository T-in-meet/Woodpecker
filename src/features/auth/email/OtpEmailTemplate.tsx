import type { CSSProperties } from "react";

import {
  OTP_EXPIRES_IN_MINUTES,
  type OtpPurpose,
} from "@/features/auth/constants/otp";
import { LEGAL_CONTACT } from "@/lib/constants/legal";
import { SITE_URL } from "@/lib/constants/site";

/**
 * OTP 인증 이메일 템플릿 props
 */
type OtpEmailTemplateProps = {
  /**
   * 사용자에게 전달할 OTP 인증 번호
   */
  otp: string;

  /**
   * OTP 인증 목적
   *
   * 목적에 따라 이메일 제목, 설명,
   * 미요청 안내 문구가 달라진다.
   */
  purpose: OtpPurpose;
};

/**
 * OTP 목적별 이메일 문구
 *
 * signup:
 * - 회원가입 이메일 인증
 *
 * reset-password:
 * - 비밀번호 재설정 인증
 *
 * 이메일 레이아웃은 공통으로 사용하고,
 * 인증 목적에 따라 달라지는 문구만 이 설정에서 관리한다.
 */
const EMAIL_CONTENT: Record<
  OtpPurpose,
  {
    /**
     * 메일함에서 본문 앞부분에 표시할 미리보기 문구
     */
    preview: string;

    /**
     * 이메일 본문의 제목
     */
    title: string;

    /**
     * OTP 입력을 안내하는 본문 설명
     */
    description: string;

    /**
     * 사용자가 직접 요청하지 않은 경우를 위한 보안 안내
     */
    securityNotice: string;
  }
> = {
  signup: {
    preview: "딱다구리 회원가입을 위한 이메일 인증 번호입니다.",
    title: "이메일 인증을 완료해주세요",
    description:
      "딱다구리 회원가입을 계속하려면 아래 인증 번호를 입력해주세요.",
    securityNotice:
      "본인이 회원가입을 요청하지 않았다면 이 메일을 무시해주세요.",
  },
  "reset-password": {
    preview: "딱다구리 비밀번호 재설정을 위한 인증 번호입니다.",
    title: "비밀번호 재설정 인증 번호",
    description:
      "딱다구리 비밀번호를 재설정하려면 아래 인증 번호를 입력해주세요.",
    securityNotice:
      "본인이 비밀번호 재설정을 요청하지 않았다면 이 메일을 무시해주세요.",
  },
};

/**
 * OTP 인증 이메일에서 사용하는 inline style
 *
 * 일반 웹 페이지가 아니라 실제 이메일 HTML로 렌더링되므로
 * 이메일 클라이언트 호환성을 위해 각 요소에 inline style을 적용한다.
 */
const styles = {
  wrapper: {
    width: "100%",
    margin: 0,
    padding: 0,
    backgroundColor: "#eef0f2",
    fontFamily: 'Arial, "Noto Sans KR", sans-serif',
  },
  outerCell: {
    padding: "36px 16px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e5e9",
    borderRadius: "14px",
    borderSpacing: 0,
  },
  contentCell: {
    padding: "34px 38px 28px",
  },
  brandTable: {
    borderSpacing: 0,
    marginBottom: "32px",
  },
  logo: {
    display: "block",
    width: "34px",
    height: "34px",
  },
  brandName: {
    paddingLeft: "10px",
    color: "#171717",
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: "28px",
  },
  title: {
    margin: "0 0 12px",
    color: "#171717",
    fontSize: "23px",
    fontWeight: 700,
    lineHeight: "1.4",
    letterSpacing: "-0.02em",
  },
  description: {
    margin: "0 0 26px",
    color: "#404040",
    fontSize: "15px",
    lineHeight: "1.75",
  },
  otpBox: {
    padding: "24px 20px 22px",
    backgroundColor: "#f7f8f9",
    border: "1px solid #e6e8eb",
    borderRadius: "12px",
  },
  otp: {
    margin: 0,
    color: "#171717",
    fontFamily: "Consolas, Menlo, monospace",
    fontSize: "31px",
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "0.24em",
    textAlign: "center",
  },
  expiry: {
    margin: "11px 0 28px",
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: "20px",
    textAlign: "center",
  },
  securityNotice: {
    margin: "0 0 28px",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: "1.7",
  },
  divider: {
    margin: "0 0 20px",
    border: 0,
    borderTop: "1px solid #e5e7eb",
  },
  footer: {
    margin: 0,
    color: "#7a7a7a",
    fontSize: "12px",
    lineHeight: "1.75",
  },
  footerSpacing: {
    margin: "10px 0 0",
    color: "#7a7a7a",
    fontSize: "12px",
    lineHeight: "1.75",
  },
  supportLink: {
    color: "#4b5563",
    textDecoration: "underline",
  },
  preview: {
    display: "none",
    maxHeight: 0,
    maxWidth: 0,
    overflow: "hidden",
    opacity: 0,
    color: "transparent",
    fontSize: "1px",
    lineHeight: "1px",
  },
} satisfies Record<string, CSSProperties>;

/**
 * OTP 인증 이메일 템플릿
 *
 * 발급된 OTP와 인증 목적을 기반으로
 * 사용자에게 발송할 HTML 이메일 본문을 구성한다.
 *
 * 역할:
 * - signup / reset-password 목적별 이메일 문구 구성
 * - OTP 인증 번호 강조 표시
 * - OTP 만료 시간 안내
 * - 서비스 로고 및 서비스명 표시
 * - 사용자가 요청하지 않은 인증에 대한 보안 안내
 * - 문의 이메일 및 자동 발송 안내 표시
 * - 메일함에서 사용할 미리보기(preheader) 문구 제공
 *
 * 주의:
 * - OTP 발급 및 검증은 담당하지 않는다.
 * - 이메일 제목(subject)과 실제 발송은 sendOtpEmail에서 처리한다.
 * - 인증 링크나 버튼을 추가하지 않고 기존 OTP 직접 입력 흐름을 유지한다.
 * - 이메일에 표시되는 로고는 SITE_URL을 기준으로 한 절대 URL을 사용한다.
 */
export function OtpEmailTemplate({ otp, purpose }: OtpEmailTemplateProps) {
  /**
   * 현재 OTP 목적에 맞는 이메일 문구를 선택한다.
   */
  const content = EMAIL_CONTENT[purpose];

  /**
   * 외부 이메일 클라이언트에서도 이미지를 불러올 수 있도록
   * SITE_URL 기반의 절대 URL을 사용한다.
   */
  const logoUrl = `${SITE_URL}/images/email/logo.png`;

  return (
    <>
      {/* 메일함의 제목 옆이나 본문 미리보기에 사용되는 preheader 문구 */}
      <div style={styles.preview}>{content.preview}</div>

      {/* 이메일 전체 배경과 중앙 카드 배치를 담당하는 presentation table */}
      <table
        role="presentation"
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        style={styles.wrapper}
      >
        <tbody>
          <tr>
            <td style={styles.outerCell}>
              {/* 이메일 본문 카드 */}
              <table
                role="presentation"
                width="100%"
                cellPadding="0"
                cellSpacing="0"
                style={styles.card}
              >
                <tbody>
                  <tr>
                    <td style={styles.contentCell}>
                      {/* 서비스 로고와 서비스명 */}
                      <table
                        role="presentation"
                        cellPadding="0"
                        cellSpacing="0"
                        style={styles.brandTable}
                      >
                        <tbody>
                          <tr>
                            <td>
                              {/* 이메일 HTML에서는 Next.js Image 컴포넌트를 사용할 수 없어 img를 사용한다. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={logoUrl}
                                alt="딱다구리"
                                width="34"
                                height="34"
                                style={styles.logo}
                              />
                            </td>
                            <td style={styles.brandName}>딱다구리</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 인증 목적에 따른 이메일 제목 */}
                      <h1 style={styles.title}>{content.title}</h1>

                      {/* OTP 입력 안내 */}
                      <p style={styles.description}>{content.description}</p>

                      {/* 사용자가 직접 입력할 OTP 인증 번호 */}
                      <div style={styles.otpBox}>
                        <p style={styles.otp}>{otp}</p>
                      </div>

                      {/* 서비스 OTP 정책에 따른 유효 시간 안내 */}
                      <p style={styles.expiry}>
                        인증 번호는 {OTP_EXPIRES_IN_MINUTES}분 동안 유효합니다.
                      </p>

                      {/* 사용자가 요청하지 않은 인증에 대한 보안 안내 */}
                      <p style={styles.securityNotice}>
                        {content.securityNotice}
                      </p>

                      <hr style={styles.divider} />

                      {/* 문의 연락처 */}
                      <p style={styles.footer}>
                        궁금한 점이나 도움이 필요하신가요?
                        <br />
                        <a
                          href={`mailto:${LEGAL_CONTACT.email}`}
                          style={styles.supportLink}
                        >
                          {LEGAL_CONTACT.email}
                        </a>
                        으로 문의해주세요.
                      </p>

                      {/* 자동 발송 메일 안내 */}
                      <p style={styles.footerSpacing}>
                        딱다구리 인증 요청에 따라 자동으로 발송된 메일입니다.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
