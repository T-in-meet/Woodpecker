import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NOTES_VIEW_COOKIE, useNotesView } from "../useNotesView";

function getCookieValue(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

function clearCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

afterEach(() => {
  clearCookie(NOTES_VIEW_COOKIE);
});

describe("useNotesView", () => {
  it("initialView 없으면 기본값 list를 반환한다", () => {
    const { result } = renderHook(() => useNotesView());
    expect(result.current[0]).toBe("list");
  });

  it("initialView가 전달되면 그 값으로 초기화된다", () => {
    const { result } = renderHook(() => useNotesView("cards"));
    expect(result.current[0]).toBe("cards");
  });

  it("updateView 호출 시 상태를 변경하고 쿠키에 저장한다", () => {
    const { result } = renderHook(() => useNotesView());

    act(() => {
      result.current[1]("cards");
    });

    expect(result.current[0]).toBe("cards");
    expect(getCookieValue(NOTES_VIEW_COOKIE)).toBe("cards");
  });

  it("list로 updateView 시 쿠키에 list가 저장된다", () => {
    const { result } = renderHook(() => useNotesView("cards"));

    act(() => {
      result.current[1]("list");
    });

    expect(result.current[0]).toBe("list");
    expect(getCookieValue(NOTES_VIEW_COOKIE)).toBe("list");
  });
});
