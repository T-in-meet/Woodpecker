import { expect, test } from "@playwright/test";

test.describe("Security headers (HTTP response contract)", () => {
  test("TC-01: GET / 응답에 Content-Security-Policy 헤더가 존재한다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    expect(response.ok()).toBeTruthy();
    expect(csp).toBeTruthy();
  });

  test("TC-02: CSP에 핵심 보안 디렉티브 모두 포함된다", async ({ request }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    if (!csp) {
      throw new Error("content-security-policy header is missing");
    }

    const directives = csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    const directiveNames = directives.map(
      (directive) => directive.split(" ")[0],
    );

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

    expect(directives).toEqual(
      expect.arrayContaining([
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "media-src 'none'",
      ]),
    );
  });

  test("TC-03: 강제 CSP의 script-src에는 nonce와 'strict-dynamic'이 포함된다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    if (!csp) {
      throw new Error("content-security-policy header is missing");
    }

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
  });

  test("TC-05: /api/csp-report는 report-uri 포맷 POST에 204를 반환한다", async ({
    request,
  }) => {
    const response = await request.post("/api/csp-report", {
      data: { "csp-report": { "violated-directive": "test" } },
      headers: { "content-type": "application/csp-report" },
    });
    expect(response.status()).toBe(204);
  });

  test("TC-06: /api/csp-report는 report-to 포맷(application/reports+json) POST에도 204를 반환한다", async ({
    request,
  }) => {
    const response = await request.post("/api/csp-report", {
      data: [
        {
          type: "csp-violation",
          age: 0,
          url: "http://localhost:3000/",
          user_agent: "test",
          body: {
            documentURL: "http://localhost:3000/",
            blockedURL: "http://example.com/x.js",
            effectiveDirective: "script-src-elem",
            disposition: "enforce",
            statusCode: 200,
          },
        },
      ],
      headers: { "content-type": "application/reports+json" },
    });
    expect(response.status()).toBe(204);
  });

  test("TC-07: 응답에 Reporting-Endpoints 헤더가 csp-endpoint 그룹을 정의한다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const header = response.headers()["reporting-endpoints"];
    expect(header).toBe('csp-endpoint="/api/csp-report"');
  });

  test("TC-04: 현재 보안 헤더(X-Frame-Options 포함)가 응답에 존재한다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });
});
