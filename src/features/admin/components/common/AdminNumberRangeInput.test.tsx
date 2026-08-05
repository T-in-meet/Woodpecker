import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNumberRangeInput } from "./AdminNumberRangeInput";

describe("AdminNumberRangeInput", () => {
  it("여러 인스턴스를 렌더링해도 label과 input id가 중복되지 않는다", () => {
    render(
      <div>
        <AdminNumberRangeInput
          value={{ min: null, max: null }}
          onValueChange={vi.fn()}
        />
        <AdminNumberRangeInput
          value={{ min: 10, max: 20 }}
          onValueChange={vi.fn()}
        />
      </div>,
    );

    const minInputs = screen.getAllByLabelText("최소값");
    const maxInputs = screen.getAllByLabelText("최대값");
    const inputIds = [...minInputs, ...maxInputs].map((input) => input.id);

    expect(new Set(inputIds).size).toBe(inputIds.length);
  });
});
