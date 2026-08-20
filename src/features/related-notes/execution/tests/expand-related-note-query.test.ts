import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryExpansionCompletion } from "@/features/ai/rags/query-expansion/create-query-expansion-completion";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";

import { reportRelatedNotesOperationalError } from "../../utils/report-operational-error";
import { expandRelatedNoteQuery } from "../expand-related-note-query";

vi.mock(
  "@/features/ai/rags/query-expansion/create-query-expansion-completion",
  () => ({
    createQueryExpansionCompletion: vi.fn(),
  }),
);

vi.mock("../../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

const configuration = {} as AiRuntimeChatConfiguration;
const usage = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
};

describe("expandRelatedNoteQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportRelatedNotesOperationalError).mockResolvedValue(undefined);

    vi.mocked(createQueryExpansionCompletion).mockResolvedValue({
      content: JSON.stringify({
        expandedQuery: "확장된 관련 노트 검색 질문",
      }),
      usage,
    });
  });

  it("Query Expansion 응답에서 확장된 검색 질의를 반환한다", async () => {
    const result = await expandRelatedNoteQuery({
      configuration,
      title: "대상 노트",
      content: "대상 노트 내용",
    });

    expect(createQueryExpansionCompletion).toHaveBeenCalledWith({
      configuration,
      responseSchemaName: "related_note_query_expansion_response",
      variables: {
        title: "대상 노트",
        content: "대상 노트 내용",
      },
    });

    expect(result).toEqual({
      expandedQuery: "확장된 관련 노트 검색 질문",
      usage,
    });

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("Provider 응답 직후 usage callback을 호출한다", async () => {
    const onUsage = vi.fn().mockResolvedValue(undefined);

    await expandRelatedNoteQuery({
      configuration,
      title: "대상 노트",
      content: "대상 노트 내용",
      onUsage,
    });

    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it("Query Expansion 응답이 유효한 JSON이 아니면 운영 오류를 보고하고 오류를 발생시킨다", async () => {
    vi.mocked(createQueryExpansionCompletion).mockResolvedValue({
      content: "invalid-json",
      usage,
    });

    await expect(
      expandRelatedNoteQuery({
        configuration,
        title: "대상 노트",
        content: "대상 노트 내용",
      }),
    ).rejects.toThrow(
      "Related note query expansion response is not valid JSON.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.any(SyntaxError),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
      message: "Related Note 검색 질의 확장 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_QUERY_EXPANSION_RESPONSE,
      context: {
        title: "대상 노트",
      },
    });
  });

  it("Query Expansion 응답이 예상한 형식과 다르면 운영 오류를 보고하고 오류를 발생시킨다", async () => {
    vi.mocked(createQueryExpansionCompletion).mockResolvedValue({
      content: JSON.stringify({
        expandedQuery: "",
      }),
      usage,
    });

    await expect(
      expandRelatedNoteQuery({
        configuration,
        title: "대상 노트",
        content: "대상 노트 내용",
      }),
    ).rejects.toThrow(
      "Related note query expansion response does not match the expected schema.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message:
          "Related note query expansion response does not match the expected schema.",
      }),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_VALIDATION_FAILED,
      message:
        "Related Note 검색 질의 확장 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_QUERY_EXPANSION_RESPONSE,
      context: {
        title: "대상 노트",
      },
    });
  });
});
