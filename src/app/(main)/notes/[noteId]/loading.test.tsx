import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NoteDetailLoading from "./loading";

describe("NoteDetailLoading", () => {
  it("저장된 노트를 불러오는 상태를 접근 가능하게 표시한다", () => {
    const { container } = render(<NoteDetailLoading />);

    expect(
      screen.getByRole("status", { name: "저장된 노트를 불러오는 중" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      container.querySelectorAll('[data-slot="skeleton"]'),
    ).not.toHaveLength(0);
  });
});
