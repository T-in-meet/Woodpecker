import { describe, expect, it } from "vitest";

import { renderPromptTemplate } from "../render";

describe("renderPromptTemplate", () => {
  it("변수를 치환한다", () => {
    expect(
      renderPromptTemplate("Hello {{name}}!", {
        name: "Woodpecker",
      }),
    ).toBe("Hello Woodpecker!");
  });

  it("공백이 있는 placeholder도 치환한다", () => {
    expect(
      renderPromptTemplate("{{  name  }}", {
        name: "Woodpecker",
      }),
    ).toBe("Woodpecker");
  });

  it("없는 변수는 placeholder를 그대로 유지한다", () => {
    expect(renderPromptTemplate("Hello {{name}}!", {})).toBe("Hello {{name}}!");
  });

  it("같은 변수를 여러 번 치환한다", () => {
    expect(
      renderPromptTemplate("{{name}} loves {{name}}.", {
        name: "AI",
      }),
    ).toBe("AI loves AI.");
  });

  it("nullish 값은 빈 문자열로 치환한다", () => {
    expect(
      renderPromptTemplate("Hello {{name}}!", {
        name: undefined as unknown as string,
      }),
    ).toBe("Hello !");
  });
});
