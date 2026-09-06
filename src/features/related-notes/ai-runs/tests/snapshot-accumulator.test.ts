import { describe, expect, it } from "vitest";

import { createRelatedNotesSnapshotAccumulator } from "../snapshot-accumulator";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";

/** 테스트 대상 accumulator를 필수 source input으로 생성합니다. */
function createAccumulator() {
  return createRelatedNotesSnapshotAccumulator({
    id: NOTE_ID,
    title: "제목",
    content: "내용",
    updatedAt: "2026-09-05T00:00:00.000Z",
  });
}

describe("createRelatedNotesSnapshotAccumulator", () => {
  it("병렬 query expansion과 exclusions stage를 서로 덮어쓰지 않는다", () => {
    const accumulator = createAccumulator();
    accumulator.setStage("exclusions", {
      input: { targetNoteId: NOTE_ID },
      configuration: {
        excludeManual: true,
        excludeDismissedAi: true,
        excludeActiveAi: false,
        resolveRelationBidirectionally: true,
        excludeTargetNote: true,
      },
      output: { excludedRelatedNoteIds: [], excludeSourceIds: [NOTE_ID] },
    });
    accumulator.setStage("queryExpansion", {
      input: {
        source: { title: "제목", content: "내용" },
        variables: { title: "제목", content: "내용" },
        renderedSystemPrompt: "system",
        renderedUserPrompt: "user",
      },
      configuration: {
        model: { id: NOTE_ID, provider: "openai", model: "model" },
        prompt: { agent: {}, family: {}, version: {} },
        temperature: 0,
      },
    });

    expect(accumulator.buildSnapshot()).toMatchObject({
      queryExpansion: { input: { renderedSystemPrompt: "system" } },
      exclusions: { output: { excludeSourceIds: [NOTE_ID] } },
    });
  });

  it("빈 final output을 정상 실행 결과로 보존한다", () => {
    const accumulator = createAccumulator();
    accumulator.completeFinalOutput([]);
    expect(accumulator.buildSnapshot()).toMatchObject({
      finalOutput: { recommendations: [] },
    });
  });
});
