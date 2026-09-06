import { describe, expect, it } from "vitest";

import { createNoteChatSnapshotAccumulator } from "../snapshot-accumulator";
import { noteChatSnapshotsSchema } from "../snapshot-schema";

describe("createNoteChatSnapshotAccumulator", () => {
  it("초기 상태와 no-context 최종 결과를 전체 문서로 build한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();

    expect(accumulator.buildSnapshot()).toEqual({ schemaVersion: 1 });

    accumulator.completeNoContextAnswer("참고할 노트가 없습니다.");

    expect(accumulator.buildSnapshot()).toEqual({
      answerGeneration: { reason: "no_context", status: "skipped" },
      finalOutput: {
        answer: "참고할 노트가 없습니다.",
        type: "no_context",
        usedNoteIds: [],
      },
      schemaVersion: 1,
    });
  });

  it("Query Expansion 실패 시 확보한 원문과 오류를 보존한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();
    const error = new Error("validation failed");

    accumulator.prepareQueryExpansion({ history: [], question: "질문" });
    accumulator.observeQueryExpansion({
      configuration: {
        model: { id: "model-id", model: "model", provider: "openai" },
        prompt: {
          agent: { id: "agent-id" },
          family: { id: "family-id" },
          version: { id: "version-id" },
        },
        temperature: 0,
      } as never,
      responseFormat: undefined,
      systemPrompt: "system",
      type: "prepared",
      userPrompt: "user",
      variables: { question: "질문" },
    });
    accumulator.observeQueryExpansion({
      result: {
        content: "raw response",
        metadata: {},
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
      type: "completed",
    });
    accumulator.failQueryExpansion(error, [{ code: "invalid" }]);

    expect(accumulator.buildSnapshot()).toMatchObject({
      queryExpansion: {
        error: {
          message: "validation failed",
          rawResponse: "raw response",
          validationIssues: [{ code: "invalid" }],
        },
        output: { rawResponse: "raw response" },
      },
    });
  });

  it("Retrieval 후보는 한 번만 저장하고 선택된 Context 후보를 index로 보존한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();

    const firstCandidate = {
      chunkText: "첫 번째 검색 chunk",
      distance: 0.1,
      embeddingId: "embedding-1",
      id: "note-1",
      similarity: 0.9,
      title: "첫 번째 노트",
    };

    const secondCandidate = {
      chunkText: "두 번째 검색 chunk",
      distance: 0.2,
      embeddingId: "embedding-2",
      id: "note-2",
      similarity: 0.8,
      title: "두 번째 노트",
    };

    const thirdCandidate = {
      chunkText: "세 번째 검색 chunk",
      distance: 0.3,
      embeddingId: "embedding-3",
      id: "note-3",
      similarity: 0.7,
      title: "세 번째 노트",
    };

    const hydratedCandidates = [
      firstCandidate,
      secondCandidate,
      thirdCandidate,
    ];

    const selectedContext = [{ ...firstCandidate }, { ...thirdCandidate }];

    accumulator.prepareRetrieval({
      configuration: {
        model: {
          dimensions: 1536,
          id: "embedding-model-id",
          model: "embedding-model",
          provider: "openai",
        },
      } as never,
      contextLimit: 2,
      inputText: "확장된 검색 질의",
      matchLimit: 20,
      minSimilarity: 0,
    });

    accumulator.completeRetrieval({
      context: "생성된 Context",
      hydratedCandidates,
      selectedContext,
      sources: [],
    });

    const snapshot = noteChatSnapshotsSchema.parse(accumulator.buildSnapshot());

    expect(snapshot.retrieval?.hydratedCandidates).toEqual([
      {
        chunk: {
          id: "embedding-1",
          inputText: "첫 번째 검색 chunk",
        },
        distance: 0.1,
        embeddingId: "embedding-1",
        note: {
          id: "note-1",
          title: "첫 번째 노트",
        },
        noteId: "note-1",
        similarity: 0.9,
        sourceId: "note-1",
      },
      {
        chunk: {
          id: "embedding-2",
          inputText: "두 번째 검색 chunk",
        },
        distance: 0.2,
        embeddingId: "embedding-2",
        note: {
          id: "note-2",
          title: "두 번째 노트",
        },
        noteId: "note-2",
        similarity: 0.8,
        sourceId: "note-2",
      },
      {
        chunk: {
          id: "embedding-3",
          inputText: "세 번째 검색 chunk",
        },
        distance: 0.3,
        embeddingId: "embedding-3",
        note: {
          id: "note-3",
          title: "세 번째 노트",
        },
        noteId: "note-3",
        similarity: 0.7,
        sourceId: "note-3",
      },
    ]);

    expect(snapshot.retrieval?.output).toEqual({
      context: "생성된 Context",
      selectedCandidateIndexes: [0, 2],
      sources: [],
    });

    expect(snapshot.retrieval?.output).not.toHaveProperty("selectedContext");

    const reconstructedSelectedContext =
      snapshot.retrieval?.output?.selectedCandidateIndexes?.map(
        (index) => snapshot.retrieval?.hydratedCandidates?.[index],
      );

    expect(reconstructedSelectedContext).toEqual([
      snapshot.retrieval?.hydratedCandidates?.[0],
      snapshot.retrieval?.hydratedCandidates?.[2],
    ]);
  });

  it("선택된 Context 후보를 찾지 못해도 Retrieval Snapshot을 보존한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();

    const hydratedCandidate = {
      chunkText: "검색된 chunk",
      distance: 0.1,
      embeddingId: "embedding-1",
      id: "note-1",
      similarity: 0.9,
      title: "검색된 노트",
    };

    const unmatchedSelectedCandidate = {
      ...hydratedCandidate,
      embeddingId: "embedding-missing",
    };

    accumulator.prepareRetrieval({
      configuration: {
        model: {
          dimensions: 1536,
          id: "embedding-model-id",
          model: "embedding-model",
          provider: "openai",
        },
      } as never,
      contextLimit: 1,
      inputText: "확장된 검색 질의",
      matchLimit: 20,
      minSimilarity: 0,
    });

    accumulator.completeRetrieval({
      context: "생성된 Context",
      hydratedCandidates: [hydratedCandidate],
      selectedContext: [unmatchedSelectedCandidate],
      sources: [],
    });

    const snapshot = noteChatSnapshotsSchema.parse(accumulator.buildSnapshot());

    expect(snapshot.retrieval?.hydratedCandidates).toEqual([
      {
        chunk: {
          id: "embedding-1",
          inputText: "검색된 chunk",
        },
        distance: 0.1,
        embeddingId: "embedding-1",
        note: {
          id: "note-1",
          title: "검색된 노트",
        },
        noteId: "note-1",
        similarity: 0.9,
        sourceId: "note-1",
      },
    ]);

    expect(snapshot.retrieval?.output).toEqual({
      context: "생성된 Context",
      sources: [],
    });

    expect(snapshot.retrieval?.output).not.toHaveProperty(
      "selectedCandidateIndexes",
    );
  });
});
