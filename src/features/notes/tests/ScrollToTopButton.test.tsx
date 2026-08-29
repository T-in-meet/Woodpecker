import "./setup";

import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollToTopButton } from "../components/ScrollToTopButton";

// jsdom에는 matchMedia 구현이 없어 spyOn이 아니라 직접 주입한다.
function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

function getButton() {
  const button = document.querySelector("[aria-label='맨 위로 이동']");
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

function scrollTo(y: number) {
  window.scrollY = y;
  act(() => {
    fireEvent.scroll(window);
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("ScrollToTopButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 버튼은 모바일(<768px)에서만 실제로 보이므로, 모바일 뷰포트를 시뮬레이션한다.
    setViewportWidth(375);
    window.scrollY = 0;
    // jsdom은 rAF를 제공하지만 콜백이 다음 틱으로 밀려 테스트가 불안정해진다.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setReducedMotion(false);
  });

  afterEach(() => {
    setViewportWidth(1024);
  });

  it("does not attach a scroll listener on desktop viewports", () => {
    setViewportWidth(1024);
    render(<ScrollToTopButton />);

    scrollTo(401);

    const button = getButton();
    expect(button.classList.contains("opacity-0")).toBe(true);
  });

  it("starts tracking scroll after resizing from desktop to mobile", () => {
    setViewportWidth(1024);
    render(<ScrollToTopButton />);

    setViewportWidth(375);
    act(() => {
      fireEvent.resize(window);
    });
    scrollTo(401);

    expect(screen.getByRole("button", { name: "맨 위로 이동" })).toHaveClass(
      "opacity-100",
    );
  });

  it("stops showing the button after resizing from mobile to desktop", () => {
    render(<ScrollToTopButton />);
    scrollTo(401);

    setViewportWidth(1024);
    act(() => {
      fireEvent.resize(window);
    });

    expect(getButton()).toHaveClass("opacity-0");
  });

  it("hides the button until the page is scrolled past the threshold", () => {
    render(<ScrollToTopButton />);

    // aria-hidden 상태에서는 접근성 이름으로 조회되지 않으므로 label 속성으로 찾는다.
    const button = getButton();
    expect(button.classList.contains("opacity-0")).toBe(true);
    expect(button).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");
  });

  it("shows the button once scrolled past the threshold", () => {
    render(<ScrollToTopButton />);

    scrollTo(401);

    const button = screen.getByRole("button", { name: "맨 위로 이동" });
    expect(button.classList.contains("opacity-100")).toBe(true);
    expect(button).not.toHaveAttribute("aria-hidden", "true");
  });

  it("hides the button again when scrolled back near the top", () => {
    render(<ScrollToTopButton />);

    scrollTo(401);
    scrollTo(100);

    // aria-hidden 상태에서는 접근성 이름으로 조회되지 않으므로 label 속성으로 찾는다.
    const button = getButton();
    expect(button.classList.contains("opacity-0")).toBe(true);
  });

  it("scrolls to the top smoothly on click", () => {
    render(<ScrollToTopButton />);
    scrollTo(401);

    fireEvent.click(screen.getByRole("button", { name: "맨 위로 이동" }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("skips smooth scrolling when the user prefers reduced motion", () => {
    setReducedMotion(true);

    render(<ScrollToTopButton />);
    scrollTo(401);

    fireEvent.click(screen.getByRole("button", { name: "맨 위로 이동" }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
