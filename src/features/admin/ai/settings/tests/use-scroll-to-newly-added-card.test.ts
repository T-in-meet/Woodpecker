// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollToNewlyAddedCard } from "../hooks/use-scroll-to-newly-added-card";

type TestField = {
  id: string;
};

/**
 * 읽기 전용 DOM 치수 값을 테스트용으로 설정합니다.
 *
 * @param element 값을 설정할 DOM 요소
 * @param property 설정할 DOM 속성
 * @param value 설정할 값
 */
function setElementMetric(
  element: HTMLElement,
  property: "clientHeight" | "offsetTop" | "scrollHeight",
  value: number,
) {
  Object.defineProperty(element, property, {
    configurable: true,
    value,
  });
}

describe("useScrollToNewlyAddedCard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);

        return 1;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("markPendingScroll을 호출하지 않으면 필드가 추가되어도 스크롤하지 않는다", () => {
    const scroller = document.createElement("div");
    const card = document.createElement("div");

    scroller.style.overflowY = "auto";
    scroller.appendChild(card);
    document.body.appendChild(scroller);

    setElementMetric(scroller, "scrollHeight", 1000);
    setElementMetric(scroller, "clientHeight", 500);

    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;

    const initialFields: TestField[] = [{ id: "field-1" }];

    const { result, rerender } = renderHook(
      ({ fields }) => useScrollToNewlyAddedCard(fields),
      {
        initialProps: {
          fields: initialFields,
        },
      },
    );

    act(() => {
      result.current.registerCardRef("field-2")(card);
    });

    rerender({
      fields: [...initialFields, { id: "field-2" }],
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("새 필드를 추가하면 해당 카드의 스크롤 가능한 조상으로 이동한다", () => {
    const scroller = document.createElement("div");
    const card = document.createElement("div");

    scroller.style.overflowY = "auto";
    scroller.appendChild(card);
    document.body.appendChild(scroller);

    setElementMetric(scroller, "scrollHeight", 1000);
    setElementMetric(scroller, "clientHeight", 500);
    setElementMetric(scroller, "offsetTop", 100);
    setElementMetric(card, "offsetTop", 400);

    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;

    const initialFields: TestField[] = [{ id: "field-1" }];

    const { result, rerender } = renderHook(
      ({ fields }) => useScrollToNewlyAddedCard(fields),
      {
        initialProps: {
          fields: initialFields,
        },
      },
    );

    act(() => {
      result.current.registerCardRef("field-2")(card);
      result.current.markPendingScroll();
    });

    rerender({
      fields: [...initialFields, { id: "field-2" }],
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 276,
      behavior: "smooth",
    });
  });

  it("여러 스크롤 가능한 조상이 있으면 가장 가까운 조상을 사용한다", () => {
    const outerScroller = document.createElement("div");
    const innerScroller = document.createElement("div");
    const card = document.createElement("div");

    outerScroller.style.overflowY = "auto";
    innerScroller.style.overflowY = "scroll";

    innerScroller.appendChild(card);
    outerScroller.appendChild(innerScroller);
    document.body.appendChild(outerScroller);

    setElementMetric(outerScroller, "scrollHeight", 2000);
    setElementMetric(outerScroller, "clientHeight", 1000);

    setElementMetric(innerScroller, "scrollHeight", 1000);
    setElementMetric(innerScroller, "clientHeight", 500);
    setElementMetric(innerScroller, "offsetTop", 100);

    setElementMetric(card, "offsetTop", 400);

    const outerScrollTo = vi.fn();
    const innerScrollTo = vi.fn();

    outerScroller.scrollTo = outerScrollTo;
    innerScroller.scrollTo = innerScrollTo;

    const { result, rerender } = renderHook(
      ({ fields }) => useScrollToNewlyAddedCard(fields),
      {
        initialProps: {
          fields: [{ id: "field-1" }] satisfies TestField[],
        },
      },
    );

    act(() => {
      result.current.registerCardRef("field-2")(card);
      result.current.markPendingScroll();
    });

    rerender({
      fields: [{ id: "field-1" }, { id: "field-2" }],
    });

    expect(innerScrollTo).toHaveBeenCalledTimes(1);
    expect(outerScrollTo).not.toHaveBeenCalled();
  });

  it("계산된 스크롤 위치가 최대 스크롤 범위를 넘으면 최대값으로 제한한다", () => {
    const scroller = document.createElement("div");
    const card = document.createElement("div");

    scroller.style.overflowY = "auto";
    scroller.appendChild(card);
    document.body.appendChild(scroller);

    setElementMetric(scroller, "scrollHeight", 700);
    setElementMetric(scroller, "clientHeight", 500);
    setElementMetric(scroller, "offsetTop", 0);

    setElementMetric(card, "offsetTop", 1000);

    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;

    const { result, rerender } = renderHook(
      ({ fields }) => useScrollToNewlyAddedCard(fields),
      {
        initialProps: {
          fields: [{ id: "field-1" }] satisfies TestField[],
        },
      },
    );

    act(() => {
      result.current.registerCardRef("field-2")(card);
      result.current.markPendingScroll();
    });

    rerender({
      fields: [{ id: "field-1" }, { id: "field-2" }],
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: "smooth",
    });
  });
});
