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
            value: "max-age=63072000; includeSubDomains",
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
});
