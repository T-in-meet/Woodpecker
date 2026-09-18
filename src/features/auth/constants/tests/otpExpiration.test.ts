import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OTP_EXPIRES_IN_MINUTES,
  OTP_EXPIRES_IN_SECONDS,
} from "@/features/auth/constants/otp";

const SUPABASE_CONFIG_PATH = join(process.cwd(), "supabase/config.toml");
const AUTH_EMAIL_SECTION_PATTERN = /^\[auth\.email\]\s*(?:#.*)?$/;
const OTP_EXPIRY_PATTERN = /^otp_expiry\s*=\s*(\d+)\s*(?:#.*)?$/;

function parseLocalOtpExpirySeconds(config: string): number {
  const lines = config.split(/\r?\n/);

  let inAuthEmailSection = false;
  let foundAuthEmailSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!inAuthEmailSection) {
      if (AUTH_EMAIL_SECTION_PATTERN.test(line)) {
        inAuthEmailSection = true;
        foundAuthEmailSection = true;
      }

      continue;
    }

    if (line.startsWith("[")) {
      break;
    }

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const match = OTP_EXPIRY_PATTERN.exec(line);

    if (match) {
      return Number(match[1]);
    }
  }

  if (!foundAuthEmailSection) {
    throw new Error("supabase/config.toml에 [auth.email] section이 없습니다.");
  }

  throw new Error(
    "supabase/config.toml의 [auth.email]에 otp_expiry가 없습니다.",
  );
}

function readLocalOtpExpirySeconds(): number {
  return parseLocalOtpExpirySeconds(readFileSync(SUPABASE_CONFIG_PATH, "utf8"));
}

describe("OTP expiration contract", () => {
  it("Woodpecker OTP hard expiration은 600초/10분이다", () => {
    expect(OTP_EXPIRES_IN_SECONDS).toBe(600);
    expect(OTP_EXPIRES_IN_MINUTES).toBe(10);
  });

  it("Local Supabase Email OTP expiration은 Woodpecker 정책과 일치한다", () => {
    expect(readLocalOtpExpirySeconds()).toBe(OTP_EXPIRES_IN_SECONDS);
  });
});

describe("Local Supabase Email OTP expiration config parser", () => {
  it("[auth.email]의 otp_expiry를 읽는다", () => {
    const config = `
[auth]
enabled = true

[auth.email]
otp_expiry = 600

[auth.sms]
otp_expiry = 999
`;

    expect(parseLocalOtpExpirySeconds(config)).toBe(600);
  });

  it("[auth.email] section이 없으면 실패한다", () => {
    const config = `
[auth]
enabled = true

[auth.sms]
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email] section이 없습니다.",
    );
  });

  it("[auth.email]에 otp_expiry가 없으면 실패한다", () => {
    const config = `
[auth.email]
enable_signup = true

[auth.sms]
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });

  it("다른 section의 otp_expiry를 [auth.email] 값으로 사용하지 않는다", () => {
    const config = `
[auth.sms]
otp_expiry = 600

[auth.email]
enable_signup = true

[auth.external.google]
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });

  it("inline comment가 붙은 다음 section의 otp_expiry를 읽지 않는다", () => {
    const config = `
[auth.email]
enable_signup = true

[auth.sms] # SMS 설정
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });

  it("array-of-tables의 otp_expiry를 [auth.email] 값으로 읽지 않는다", () => {
    const config = `
[auth.email]
enable_signup = true

[[services]]
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });

  it("inline comment가 붙은 array-of-tables의 otp_expiry를 읽지 않는다", () => {
    const config = `
[auth.email]
enable_signup = true

[[services]] # service list
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });

  it("quoted table header 뒤의 otp_expiry를 [auth.email] 값으로 읽지 않는다", () => {
    const config = `
[auth.email]
enable_signup = true

["foo]bar"]
otp_expiry = 600
`;

    expect(() => parseLocalOtpExpirySeconds(config)).toThrow(
      "[auth.email]에 otp_expiry가 없습니다.",
    );
  });
});
