import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSessionMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import {
  buildCspEnforced,
  buildCspReportOnly,
  buildReportingEndpoints,
  config,
  middleware,
} from "./middleware";

function matchesMiddleware(pathname: string) {
  const matcher = config.matcher[0];

  if (!matcher) {
    throw new Error("Expected middleware matcher to be configured.");
  }

  return new RegExp(`^${matcher}$`).test(pathname);
}

describe("middleware request headers", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    updateSessionMock.mockResolvedValue(NextResponse.next());
  });

  it("법적 문서 확인 후 복원할 수 있도록 pathname과 search를 함께 전달한다", async () => {
    await middleware(new NextRequest("http://localhost/notes?page=3"));

    expect(updateSessionMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({
        "x-pathname": "/notes?page=3",
      }),
    );
  });
});

describe("middleware matcher", () => {
  it.each([
    { expected: false, pathname: "/sw.js" },
    { expected: false, pathname: "/sw.js.map" },
    { expected: false, pathname: "/swe-worker-abc.js" },
    { expected: false, pathname: "/swe-worker-abc.js.map" },
    { expected: false, pathname: "/api/auth/hooks/send-email" },
    { expected: false, pathname: "/api/csp-report" },
    { expected: true, pathname: "/notes" },
    { expected: true, pathname: "/mypage" },
  ])("matches $pathname => $expected", ({ pathname, expected }) => {
    expect(matchesMiddleware(pathname)).toBe(expected);
  });
});

describe("CSP — buildCspEnforced", () => {
  const NONCE = "test-nonce-abc123";

  it("TC-CSP-M-01. 모든 필수 디렉티브가 포함된다", () => {
    const csp = buildCspEnforced(NONCE);
    const directiveNames = csp.split("; ").map((d) => d.split(" ")[0]);

    expect(directiveNames).toEqual(
      expect.arrayContaining([
        "default-src",
        "object-src",
        "base-uri",
        "frame-ancestors",
        "frame-src",
        "form-action",
        "script-src",
        "style-src",
        "img-src",
        "connect-src",
        "font-src",
        "worker-src",
        "media-src",
        "manifest-src",
        "report-uri",
        "report-to",
      ]),
    );
  });

  it("TC-CSP-M-02. script-src에 nonce와 'strict-dynamic'이 포함된다", () => {
    const csp = buildCspEnforced(NONCE);
    expect(csp).toContain(
      `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`,
    );
  });

  it("TC-CSP-M-02-01. 개발 환경에서는 script-src에 'unsafe-eval'을 포함한다", () => {
    vi.stubEnv("NODE_ENV", "development");

    const csp = buildCspEnforced(NONCE);
    const scriptSrc = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(scriptSrc).toBe(
      `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`,
    );

    vi.unstubAllEnvs();
  });

  it("TC-CSP-M-02-02. 운영 환경에서는 script-src에 'unsafe-eval'을 포함하지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");

    const csp = buildCspEnforced(NONCE);
    const scriptSrc = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(scriptSrc).toBe(
      `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`,
    );
    expect(scriptSrc).not.toContain("'unsafe-eval'");

    vi.unstubAllEnvs();
  });

  it("TC-CSP-M-03. style-src에 'unsafe-inline'이 허용된다 (React 19 hoisting/CSS-in-JS 호환)", () => {
    const csp = buildCspEnforced(NONCE);
    const styleSrc = csp.split("; ").find((d) => d.startsWith("style-src "));
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("TC-CSP-M-04. object-src 'none', frame-ancestors 'none', frame-src 'none', media-src 'none'", () => {
    const csp = buildCspEnforced(NONCE);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("media-src 'none'");
  });

  it("TC-CSP-M-05. report-uri /api/csp-report와 report-to csp-endpoint를 병기한다", () => {
    const csp = buildCspEnforced(NONCE);
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
  });

  it("TC-CSP-M-06. 모든 디렉티브가 '; ' 로 구분되고 빈 디렉티브가 없다", () => {
    const csp = buildCspEnforced(NONCE);
    const directives = csp.split("; ");
    expect(directives.every((d) => d.trim().length > 0)).toBe(true);
  });

  it("TC-CSP-M-07.개발 환경에서는 로컬 Supabase origin을 img-src에 포함한다", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    const csp = buildCspEnforced(NONCE);
    const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src "));

    expect(imgSrc).toContain("http://127.0.0.1:54321");

    vi.unstubAllEnvs();
  });

  it("TC-CSP-M-08.운영 환경에서는 로컬 Supabase origin을 img-src에 포함하지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    const csp = buildCspEnforced(NONCE);
    const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src "));

    expect(imgSrc).not.toContain("http://127.0.0.1:54321");

    vi.unstubAllEnvs();
  });
});

describe("CSP — buildCspReportOnly", () => {
  const NONCE = "test-nonce-xyz789";

  it("TC-CSP-RO-01. style-src에 'unsafe-inline'이 허용된다", () => {
    const csp = buildCspReportOnly(NONCE);
    const styleSrc = csp.split("; ").find((d) => d.startsWith("style-src "));
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("TC-CSP-RO-02. report-uri /api/csp-report와 report-to csp-endpoint를 병기한다", () => {
    const csp = buildCspReportOnly(NONCE);
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
  });
});

describe("Reporting-Endpoints — buildReportingEndpoints", () => {
  it("TC-RE-01. csp-endpoint 그룹이 /api/csp-report 경로를 가리킨다", () => {
    expect(buildReportingEndpoints()).toBe('csp-endpoint="/api/csp-report"');
  });
});
