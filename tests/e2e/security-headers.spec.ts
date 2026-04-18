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

  test("TC-02: CSP는 정확히 3개 directive(object-src/base-uri/frame-ancestors)로 구성된다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();

    const directives = csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    expect(directives).toHaveLength(3);
    expect(directives).toEqual(
      expect.arrayContaining([
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ]),
    );
  });

  test("TC-03: 강제 CSP에는 default-src/script-src 등 불필요 directive가 포함되지 않는다", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();

    const directives = csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    const directiveNames = directives.map(
      (directive) => directive.split(" ")[0],
    );

    expect(directiveNames).not.toContain("default-src");
    expect(directiveNames).not.toContain("script-src");
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
