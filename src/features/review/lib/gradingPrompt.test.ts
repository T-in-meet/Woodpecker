import { describe, expect, it } from "vitest";

import { buildGradingPrompt } from "./gradingPrompt";

describe("buildGradingPrompt", () => {
  it("includes the note title, original content, and user answer", () => {
    const prompt = buildGradingPrompt("노트 제목", "원본 내용", "사용자 답안");

    expect(prompt).toContain("노트 제목");
    expect(prompt).toContain("원본 내용");
    expect(prompt).toContain("사용자 답안");
  });

  it("instructs grading based only on the original note", () => {
    const prompt = buildGradingPrompt("제목", "내용", "답안");

    expect(prompt).toContain("원본 노트 내용만을 채점 기준");
    expect(prompt).toContain("JSON 형식으로만 응답");
  });
});
