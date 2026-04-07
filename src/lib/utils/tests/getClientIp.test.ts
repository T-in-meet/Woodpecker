import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { getClientIp } from "../getClientIp";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers,
  });
}

describe("getClientIp", () => {
  it("TC-01. x-real-ip가 존재하면 해당 값을 반환한다", () => {
    const request = makeRequest({ "x-real-ip": "1.2.3.4" });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("TC-02. x-real-ip 앞뒤 공백은 trim 후 반환한다", () => {
    const request = makeRequest({ "x-real-ip": "  1.2.3.4  " });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("TC-03. x-real-ip와 x-forwarded-for가 모두 존재하면 x-real-ip를 우선한다", () => {
    const request = makeRequest({
      "x-real-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9",
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("TC-04. x-real-ip가 없고 x-forwarded-for가 존재하면 해당 값을 반환한다", () => {
    const request = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("TC-05. x-forwarded-for 앞뒤 공백은 trim 후 반환한다", () => {
    const request = makeRequest({ "x-forwarded-for": "  1.2.3.4  " });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("TC-06. 두 헤더 모두 없으면 unknown을 반환한다", () => {
    const request = makeRequest({});
    expect(getClientIp(request)).toBe("unknown");
  });

  it("TC-07. x-forwarded-for가 빈 문자열이면 unknown을 반환한다", () => {
    const request = makeRequest({ "x-forwarded-for": "" });
    expect(getClientIp(request)).toBe("unknown");
  });
});
