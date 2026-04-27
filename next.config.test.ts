/**
 * next.config.ts 보안 헤더 정의 검증
 *
 * 테스트 범위:
 * - headers() 함수 존재 여부
 * - source "/(.*)"에 각 보안 헤더 포함 여부
 * - production 환경에서 HSTS 포함, non-production에서 제외
 * - 기존 images.remotePatterns 설정 유지
 *
 * 전략:
 * - Vitest/jsdom 환경에서는 실제 HTTP 응답 헤더를 인터셉트할 수 없으므로
 *   headers() 반환값을 직접 호출하여 config 단위로 검증한다
 * - must_verify_headers_defined_in_next_config 항목 충족
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "./next.config";

/**
 * headers() 반환값에서 source "/(.*)" 항목의 헤더 배열을 추출하는 헬퍼
 */
async function getGlobalHeaders(): Promise<{ key: string; value: string }[]> {
  const headerGroups = await nextConfig.headers!();
  const globalGroup = headerGroups.find((g) => g.source === "/(.*)");
  return (globalGroup?.headers ?? []) as { key: string; value: string }[];
}

/**
 * CSP 헤더 값을 추출하는 헬퍼
 */
async function getCspHeader(
  key: "Content-Security-Policy" | "Content-Security-Policy-Report-Only",
): Promise<string | undefined> {
  const headers = await getGlobalHeaders();
  return headers.find((h) => h.key === key)?.value;
}

describe("Security Headers — next.config.ts", () => {
  describe("TC-SH-01: headers() 함수 정의", () => {
    it("TC-SH-01. headers() 함수가 정의되어 있다", () => {
      expect(typeof nextConfig.headers).toBe("function");
    });
  });

  describe("TC-SH-02~05: 공통 보안 헤더 (환경 무관)", () => {
    it("TC-SH-02. source '/(.*)'에 X-Frame-Options: DENY 포함", async () => {
      const headers = await getGlobalHeaders();
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "X-Frame-Options", value: "DENY" }),
        ]),
      );
    });

    it("TC-SH-03. source '/(.*)'에 X-Content-Type-Options: nosniff 포함", async () => {
      const headers = await getGlobalHeaders();
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "X-Content-Type-Options",
            value: "nosniff",
          }),
        ]),
      );
    });

    it("TC-SH-04. source '/(.*)'에 Referrer-Policy: strict-origin-when-cross-origin 포함", async () => {
      const headers = await getGlobalHeaders();
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          }),
        ]),
      );
    });

    it("TC-SH-05. source '/(.*)'에 Permissions-Policy: camera=(), microphone=(), geolocation=() 포함", async () => {
      const headers = await getGlobalHeaders();
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          }),
        ]),
      );
    });
  });

  describe("TC-SH-06~07: HSTS (NODE_ENV 분기)", () => {
    afterEach(() => {
      // vi.stubEnv로 설정한 env 변수를 모두 원복 — 테스트 간 상태 오염 방지
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("TC-SH-06. production 환경에서 Strict-Transport-Security 헤더가 포함된다", async () => {
      // isProduction이 headers() 내부에서 평가되므로 직접 호출 시 즉시 반영됨
      vi.stubEnv("NODE_ENV", "production");
      const headers = await getGlobalHeaders();
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "Strict-Transport-Security",
            value: "max-age=300; includeSubDomains",
          }),
        ]),
      );
    });

    it("TC-SH-07. non-production 환경에서 Strict-Transport-Security 헤더가 없다", async () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = await getGlobalHeaders();
      const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
      expect(hsts).toBeUndefined();
    });
  });

  describe("TC-SH-08: 기존 설정 유지", () => {
    it("TC-SH-08. 기존 images.remotePatterns 설정이 정확히 유지된다", () => {
      expect(nextConfig.images).toBeDefined();
      const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME;

      const expected = supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              port: "",
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : [];

      expect(nextConfig.images?.remotePatterns).toEqual(expected);
    });
  });

  describe("CSP 헤더 — next.config.ts", () => {
    describe("TC-CSP-01~05: Content-Security-Policy (강제)", () => {
      it("TC-CSP-01. Content-Security-Policy 헤더가 존재한다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        expect(cspEnforced).toBeDefined();
        expect(typeof cspEnforced).toBe("string");
      });

      it("TC-CSP-02. 강제 CSP에 object-src 'none' 디렉티브가 포함된다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        expect(cspEnforced).toContain("object-src 'none'");
      });

      it("TC-CSP-03. 강제 CSP에 base-uri 'self' 디렉티브가 포함된다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        expect(cspEnforced).toContain("base-uri 'self'");
      });

      it("TC-CSP-04. 강제 CSP에 frame-ancestors 'none' 디렉티브가 포함된다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        expect(cspEnforced).toContain("frame-ancestors 'none'");
      });

      it("TC-CSP-05. 강제 CSP 값이 정확히 3개 디렉티브만 포함한다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        const directives = (cspEnforced?.split("; ") ?? []).filter(Boolean);

        expect(new Set(directives)).toEqual(
          new Set([
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
          ]),
        );
      });
    });

    describe("TC-CSP-06~09: Content-Security-Policy-Report-Only (관측)", () => {
      it("TC-CSP-06. Content-Security-Policy-Report-Only 헤더가 존재한다", async () => {
        const cspReportOnly = await getCspHeader(
          "Content-Security-Policy-Report-Only",
        );
        expect(cspReportOnly).toBeDefined();
        expect(typeof cspReportOnly).toBe("string");
      });

      it("TC-CSP-07. Report-Only CSP에 default-src 'self' 포함", async () => {
        const cspReportOnly = await getCspHeader(
          "Content-Security-Policy-Report-Only",
        );
        expect(cspReportOnly).toContain("default-src 'self'");
      });

      it("TC-CSP-08. Report-Only CSP에 script-src, style-src, img-src, font-src, connect-src 포함", async () => {
        const cspReportOnly = await getCspHeader(
          "Content-Security-Policy-Report-Only",
        );
        expect(cspReportOnly).toContain("script-src");
        expect(cspReportOnly).toContain("style-src");
        expect(cspReportOnly).toContain("img-src");
        expect(cspReportOnly).toContain("font-src");
        expect(cspReportOnly).toContain("connect-src");
        expect(cspReportOnly).toContain("worker-src 'self'");
      });

      it("TC-CSP-09. Report-Only CSP에 강제 CSP 디렉티브(object-src, base-uri, frame-ancestors)가 없다", async () => {
        const cspReportOnly = await getCspHeader(
          "Content-Security-Policy-Report-Only",
        );
        expect(cspReportOnly).not.toContain("object-src 'none'");
        expect(cspReportOnly).not.toContain("base-uri 'self'");
        expect(cspReportOnly).not.toContain("frame-ancestors 'none'");
      });
    });

    describe("TC-CSP-10~12: 형식 및 중복 검증", () => {
      it("TC-CSP-10. CSP 헤더 중복 없음 — Content-Security-Policy는 정확히 1개", async () => {
        const headers = await getGlobalHeaders();
        const cspCount = headers.filter(
          (h) => h.key === "Content-Security-Policy",
        ).length;
        expect(cspCount).toBe(1);
      });

      it("TC-CSP-11. Report-Only 헤더 중복 없음 — Content-Security-Policy-Report-Only는 정확히 1개", async () => {
        const headers = await getGlobalHeaders();
        const reportOnlyCount = headers.filter(
          (h) => h.key === "Content-Security-Policy-Report-Only",
        ).length;
        expect(reportOnlyCount).toBe(1);
      });

      it("TC-CSP-12. 두 CSP 헤더 값 모두 string 타입이다", async () => {
        const cspEnforced = await getCspHeader("Content-Security-Policy");
        const cspReportOnly = await getCspHeader(
          "Content-Security-Policy-Report-Only",
        );
        expect(typeof cspEnforced).toBe("string");
        expect(typeof cspReportOnly).toBe("string");
      });
    });
  });
});
