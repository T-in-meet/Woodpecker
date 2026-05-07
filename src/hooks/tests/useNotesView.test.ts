import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NOTES_VIEW_STORAGE_KEY, useNotesView } from "../useNotesView";

describe("useNotesView", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("localStorage가 비어 있으면 기본값 list를 반환한다", async () => {
    const { result } = renderHook(() => useNotesView());
    await act(async () => {});
    expect(result.current[0]).toBe("list");
  });

  it("initialView가 전달되면 localStorage가 없을 때 그 값을 사용한다", async () => {
    const { result } = renderHook(() => useNotesView("cards"));
    await act(async () => {});
    // localStorage 없으므로 initialView 유지
    expect(result.current[0]).toBe("cards");
  });

  it("localStorage에 저장된 값을 마운트 시 읽어 적용한다", async () => {
    localStorage.setItem(NOTES_VIEW_STORAGE_KEY, "cards");
    const { result } = renderHook(() => useNotesView());
    await act(async () => {});
    expect(result.current[0]).toBe("cards");
  });

  it("updateView 호출 시 상태를 변경하고 localStorage에 저장한다", () => {
    const { result } = renderHook(() => useNotesView());

    act(() => {
      result.current[1]("cards");
    });

    expect(result.current[0]).toBe("cards");
    expect(localStorage.getItem(NOTES_VIEW_STORAGE_KEY)).toBe("cards");
  });

  it("유효하지 않은 localStorage 값은 무시하고 기본값 list를 유지한다", async () => {
    localStorage.setItem(NOTES_VIEW_STORAGE_KEY, "grid");
    const { result } = renderHook(() => useNotesView());
    await act(async () => {});
    expect(result.current[0]).toBe("list");
  });

  it("list로 updateView 시 localStorage에 list가 저장된다", () => {
    localStorage.setItem(NOTES_VIEW_STORAGE_KEY, "cards");
    const { result } = renderHook(() => useNotesView("cards"));

    act(() => {
      result.current[1]("list");
    });

    expect(result.current[0]).toBe("list");
    expect(localStorage.getItem(NOTES_VIEW_STORAGE_KEY)).toBe("list");
  });
});
