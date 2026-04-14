import { describe, expect, it } from "vitest";

import { normalizeImageSrc, normalizeLinkHref } from "../utils/linkValidation";

describe("normalizeLinkHref", () => {
  it("unwraps markdown angle-bracket destinations", () => {
    expect(normalizeLinkHref("<https://example.com/docs>")).toBe(
      "https://example.com/docs",
    );
  });
});

describe("normalizeImageSrc", () => {
  it("unwraps markdown angle-bracket image destinations", () => {
    expect(normalizeImageSrc("<https://example.com/image.png>")).toBe(
      "https://example.com/image.png",
    );
  });

  it("normalizes scheme-less external image URLs", () => {
    expect(normalizeImageSrc("example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
  });

  it("normalizes protocol-relative image URLs to https", () => {
    expect(normalizeImageSrc("//cdn.example.com/image.png")).toBe(
      "https://cdn.example.com/image.png",
    );
  });

  it("rejects image URLs with embedded credentials", () => {
    expect(
      normalizeImageSrc("https://user:pass@example.com/private.png"),
    ).toBeNull();
    expect(normalizeImageSrc("//user:pass@example.com/private.png")).toBeNull();
  });

  it("rejects relative image paths", () => {
    expect(normalizeImageSrc("/image.png")).toBeNull();
    expect(normalizeImageSrc("./image.png")).toBeNull();
    expect(normalizeImageSrc("../image.png")).toBeNull();
  });

  it("encodes whitespace in scheme-less image URLs", () => {
    expect(normalizeImageSrc("  example.com/my image.png  ")).toBe(
      "https://example.com/my%20image.png",
    );
  });

  it("rejects localhost and loopback image URLs", () => {
    expect(normalizeImageSrc("http://localhost:3000/image.png")).toBeNull();
    expect(normalizeImageSrc("https://127.0.0.1/image.png")).toBeNull();
    expect(normalizeImageSrc("//foo.localhost/image.png")).toBeNull();
  });

  it("rejects IPv6 literal image URLs", () => {
    expect(normalizeImageSrc("https://[::1]/image.png")).toBeNull();
    expect(normalizeImageSrc("https://[2001:db8::1]/image.png")).toBeNull();
  });

  it("rejects unsafe image protocols", () => {
    expect(normalizeImageSrc("data:image/png;base64,abc")).toBeNull();
    expect(normalizeImageSrc("javascript:alert(1)")).toBeNull();
  });
});
