import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { config } from "./middleware";

function matchesMiddleware(pathname: string) {
  const matcher = config.matcher[0];

  if (!matcher) {
    throw new Error("Expected middleware matcher to be configured.");
  }

  return new RegExp(`^${matcher}$`).test(pathname);
}

describe("middleware matcher", () => {
  it.each([
    { expected: false, pathname: "/sw.js" },
    { expected: false, pathname: "/sw.js.map" },
    { expected: false, pathname: "/swe-worker-abc.js" },
    { expected: false, pathname: "/swe-worker-abc.js.map" },
    { expected: false, pathname: "/api/auth/hooks/send-email" },
    { expected: true, pathname: "/notes" },
    { expected: true, pathname: "/mypage" },
  ])("matches $pathname => $expected", ({ pathname, expected }) => {
    expect(matchesMiddleware(pathname)).toBe(expected);
  });
});
