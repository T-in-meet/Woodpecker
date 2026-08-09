import { describe, expect, it } from "vitest";

import { FEEDBACK_ITEMS_MAX } from "../schema";
import { buildGradingPrompt } from "./gradingPrompt";

describe("buildGradingPrompt", () => {
  it("includes the original content and user answer", () => {
    const prompt = buildGradingPrompt("원본 내용", "사용자 답안");

    expect(prompt).toContain("원본 내용");
    expect(prompt).toContain("사용자 답안");
  });

  // 해시(hashNoteContent)가 지키는 범위가 본문뿐이라, 제목이 프롬프트에 들어가면
  // 제목만 바뀐 노트가 해시 검사를 통과해 화면과 다른 기준으로 채점된다.
  it("does not include a note title section", () => {
    const prompt = buildGradingPrompt("원본 내용", "사용자 답안");

    expect(prompt).not.toContain("## 노트 제목");
  });

  it("instructs grading based only on the original note", () => {
    const prompt = buildGradingPrompt("내용", "답안");

    expect(prompt).toContain("원본 노트 내용만을 채점 기준");
    expect(prompt).toContain("JSON 형식으로만 응답");
  });

  // 문구의 개수와 생성 스키마의 maxItems가 갈리면 "요청한 개수"와 "강제하는 개수"가 달라진다.
  it("states the shared feedback item limit", () => {
    const prompt = buildGradingPrompt("내용", "답안");

    expect(prompt).toContain(`최대 ${FEEDBACK_ITEMS_MAX}개까지`);
  });
});
