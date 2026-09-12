import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentScrollLock } from "../DocumentScrollLock";

describe("DocumentScrollLock", () => {
  afterEach(() => {
    document.body.classList.remove("overflow-hidden");
    document.documentElement.classList.remove("no-scrollbar-gutter");
  });

  it("마운트되면 document 스크롤을 잠그고 scrollbar gutter 여백을 해제한다", () => {
    render(<DocumentScrollLock />);

    expect(document.body).toHaveClass("overflow-hidden");
    expect(document.documentElement).toHaveClass("no-scrollbar-gutter");
  });

  it("언마운트되면 추가한 document 클래스를 정리한다", () => {
    const { unmount } = render(<DocumentScrollLock />);

    unmount();

    expect(document.body).not.toHaveClass("overflow-hidden");
    expect(document.documentElement).not.toHaveClass("no-scrollbar-gutter");
  });
});
