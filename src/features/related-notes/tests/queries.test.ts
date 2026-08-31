import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

import { RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE } from "../constants/ai";
import { getRelatedNoteCandidates, getRelatedNotes } from "../queries";
import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

vi.mock("../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

const createClientMock = vi.mocked(createServerComponentClient);
const logErrorMock = vi.mocked(logError);
const requireCurrentLegalAcceptanceMock = vi.mocked(
  requireCurrentLegalAcceptance,
);
const reportRelatedNotesOperationalErrorMock = vi.mocked(
  reportRelatedNotesOperationalError,
);

const authenticatedUserId = "99999999-9999-4999-8999-999999999999";
const noteId = "11111111-1111-4111-8111-111111111111";
const sourceUpdatedAt = "2026-08-28T09:00:00.000Z";
const executionClaimId = "88888888-8888-4888-8888-888888888888";

/** 인증된 사용자를 반환하는 auth.getUser mock을 만듭니다. */
function createAuthMock() {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: authenticatedUserId } },
    }),
  };
}

/**
 * getRelatedNotes에서 사용하는 현재 Note 조회 결과를 반환합니다.
 *
 * execution claim은 Note의 source_updated_at 단위로 관리되므로
 * 테스트에서도 현재 Note의 updated_at을 명시적으로 제공합니다.
 */
function createCurrentNoteResult() {
  return {
    data: {
      updated_at: sourceUpdatedAt,
    },
  };
}

/** 일반 사용자의 profile 조회 결과를 반환합니다. */
function createUserProfileResult() {
  return {
    data: {
      role: "USER",
    },
  };
}

/**
 * Related Notes 일일 사용량 RPC mock을 만듭니다.
 *
 * 별도의 사용량을 지정하지 않으면 오늘 사용량이 없는 상태인 0을 반환합니다.
 */
function createRecommendationUsageRpcMock(used = 0) {
  return vi.fn().mockResolvedValue({
    data: used,
    error: null,
  });
}

describe("getRelatedNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("noteId가 UUID 형식이 아니면 Supabase 조회 없이 빈 결과를 반환한다", async () => {
    const result = await getRelatedNotes("not-a-uuid,origin.eq.ai");

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: null,
      relatedNotes: [],
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
  });

  it("active 관련 노트를 조회해 화면 표시 형식으로 반환한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [
          {
            note_id: noteId,
            related_note_id: "22222222-2222-4222-8222-222222222222",
            origin: "ai",
            source_note: {
              title: "현재 기준 노트 제목",
            },
            related_note: {
              title: "현재 AI 관련 노트 제목",
            },
            metadata: {
              title: "예전 AI 제목 snapshot",
              reason: "비슷한 내용을 다룹니다.",
              rank: 1,
            },
          },
          {
            note_id: noteId,
            related_note_id: "33333333-3333-4333-8333-333333333333",
            origin: "manual",
            source_note: {
              title: "현재 기준 노트 제목",
            },
            related_note: {
              title: "현재 직접 연결한 노트 제목",
            },
            metadata: {
              title: "예전 수동 제목 snapshot",
            },
          },
        ],
      },
      related_note_recommendation_execution_claims: {
        data: [
          {
            id: executionClaimId,
            status: "running",
          },
        ],
      },
    });

    const rpcMock = createRecommendationUsageRpcMock();

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      authenticatedUserId,
      getNoteDetailRoute(noteId),
    );

    const noteCalls = callsFor("notes");

    expect(noteCalls).toContainEqual(["select", ["updated_at"]]);
    expect(noteCalls).toContainEqual(["eq", ["id", noteId]]);
    expect(noteCalls).toContainEqual(["eq", ["user_id", authenticatedUserId]]);
    expect(noteCalls).toContainEqual(["maybeSingle", []]);

    const profileCalls = callsFor("profiles");

    expect(profileCalls).toContainEqual(["select", ["role"]]);
    expect(profileCalls).toContainEqual(["eq", ["id", authenticatedUserId]]);
    expect(profileCalls).toContainEqual(["maybeSingle", []]);

    const calls = callsFor("note_related_notes");

    expect(calls).toContainEqual([
      "select",
      [
        "note_id, related_note_id, origin, metadata, source_note:notes!note_related_notes_note_id_fkey(title), related_note:notes!note_related_notes_related_note_id_fkey(title)",
      ],
    ]);
    expect(calls).toContainEqual([
      "or",
      [`note_id.eq.${noteId},related_note_id.eq.${noteId}`],
    ]);
    expect(calls).toContainEqual(["eq", ["status", "active"]]);

    const executionCalls = callsFor(
      "related_note_recommendation_execution_claims",
    );

    expect(executionCalls).toContainEqual(["select", ["id, status"]]);
    expect(executionCalls).toContainEqual(["eq", ["note_id", noteId]]);
    expect(executionCalls).toContainEqual([
      "eq",
      ["source_updated_at", sourceUpdatedAt],
    ]);
    expect(executionCalls).toContainEqual([
      "order",
      ["claimed_at", { ascending: false }],
    ]);
    expect(executionCalls).toContainEqual(["limit", [1]]);

    expect(rpcMock).toHaveBeenCalledWith(
      "get_related_note_recommendation_daily_usage",
      {
        p_note_id: noteId,
      },
    );

    expect(result).toStrictEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [
        {
          noteId: "22222222-2222-4222-8222-222222222222",
          origin: "ai",
          title: "현재 AI 관련 노트 제목",
          reason: "비슷한 내용을 다룹니다.",
          rank: 1,
        },
        {
          noteId: "33333333-3333-4333-8333-333333333333",
          origin: "manual",
          title: "현재 직접 연결한 노트 제목",
        },
      ],
    });
  });

  it("현재 Note가 related_note_id에 있는 관계도 반대편 Note로 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [
          {
            note_id: "22222222-2222-4222-8222-222222222222",
            related_note_id: noteId,
            origin: "manual",
            source_note: {
              title: "저장 row의 기준 노트 제목",
            },
            related_note: {
              title: "현재 보고 있는 노트 제목",
            },
            metadata: {
              reason: "역방향에서도 같은 이유를 표시합니다.",
            },
          },
        ],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toStrictEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [
        {
          noteId: "22222222-2222-4222-8222-222222222222",
          origin: "manual",
          title: "저장 row의 기준 노트 제목",
          reason: "역방향에서도 같은 이유를 표시합니다.",
        },
      ],
    });
  });

  it("가장 최근 AI 추천 실행이 실패했으면 실패 상태를 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [
          {
            id: executionClaimId,
            status: "failed",
          },
        ],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: true,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "failed",
      },
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [],
    });
  });

  it("현재 Note version의 execution claim만 조회한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    await getRelatedNotes(noteId);

    const executionCalls = callsFor(
      "related_note_recommendation_execution_claims",
    );

    expect(executionCalls).toContainEqual(["eq", ["note_id", noteId]]);
    expect(executionCalls).toContainEqual([
      "eq",
      ["source_updated_at", sourceUpdatedAt],
    ]);
  });

  it("일반 사용자는 현재 Note의 일일 AI 추천 사용량을 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    const rpcMock = createRecommendationUsageRpcMock(1);

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(rpcMock).toHaveBeenCalledWith(
      "get_related_note_recommendation_daily_usage",
      {
        p_note_id: noteId,
      },
    );

    expect(result.recommendationUsage).toEqual({
      used: 1,
      limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
    });
  });

  it("ADMIN은 일일 사용량 RPC를 호출하지 않고 사용량을 반환하지 않는다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: {
        data: {
          role: "ADMIN",
        },
      },
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    const rpcMock = vi.fn();

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(rpcMock).not.toHaveBeenCalled();

    expect(result.recommendationUsage).toBeNull();
  });

  it("사용자 역할 조회에 실패하면 운영 오류를 보고하고 사용량을 반환하지 않는다", async () => {
    const profileError = new Error("profile query failed");

    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: {
        data: null,
        error: profileError,
      },
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    const rpcMock = vi.fn();

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(rpcMock).not.toHaveBeenCalled();

    expect(result.recommendationUsage).toBeNull();

    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: profileError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message:
        "Related Notes 일일 사용량 조회를 위한 사용자 역할 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
      userId: authenticatedUserId,
    });
  });

  it("일일 사용량 조회에 실패해도 Related Notes 조회 결과에는 영향을 주지 않는다", async () => {
    const usageError = new Error("daily usage query failed");

    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: usageError,
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: null,
      relatedNotes: [],
    });

    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: usageError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message: "Related Notes 일일 AI 추천 사용량 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
      userId: authenticatedUserId,
    });
  });

  it("일일 사용량 응답이 유효하지 않으면 오류를 기록하고 사용량을 반환하지 않는다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: -1,
      error: null,
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: rpcMock,
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result.recommendationUsage).toBeNull();

    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getRelatedNotes] AI 추천 일일 사용량 파싱 실패",
      }),
    );
    expect(reportRelatedNotesOperationalErrorMock).not.toHaveBeenCalled();
  });

  it("기준 Note 조회에 실패하면 운영 오류를 보고하고 빈 결과를 반환한다", async () => {
    const dbError = new Error("source note query failed");

    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: {
        data: null,
        error: dbError,
      },
      profiles: createUserProfileResult(),
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: null,
      relatedNotes: [],
    });
    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.SOURCE_NOTE_LOAD_FAILED,
      message: "Related Notes 조회를 위한 기준 Note 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_SOURCE_NOTE,
      context: {
        noteId,
      },
      userId: authenticatedUserId,
    });
    expect(callsFor("note_related_notes")).toEqual([]);
    expect(callsFor("related_note_recommendation_execution_claims")).toEqual(
      [],
    );
  });

  it("기준 Note가 존재하지 않으면 후속 조회 없이 빈 결과를 반환한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: {
        data: null,
      },
      profiles: createUserProfileResult(),
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: null,
      relatedNotes: [],
    });
    expect(callsFor("note_related_notes")).toEqual([]);
    expect(callsFor("related_note_recommendation_execution_claims")).toEqual(
      [],
    );
  });

  it("Related Notes 목록 조회에 실패하면 운영 오류를 보고하고 빈 배열을 반환한다", async () => {
    const dbError = new Error("related notes query failed");

    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: null,
        error: dbError,
      },
      related_note_recommendation_execution_claims: {
        data: [
          {
            id: executionClaimId,
            status: "running",
          },
        ],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [],
    });
    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTES_LOAD_FAILED,
      message: "Related Notes 목록 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTES,
      context: {
        noteId,
      },
      userId: authenticatedUserId,
    });
  });

  it("조회 결과가 스키마와 맞지 않으면 오류를 기록하고 빈 배열을 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [
          {
            note_id: noteId,
            related_note_id: "not-a-uuid",
            origin: "ai",
            source_note: {
              title: "기준 노트",
            },
            related_note: {
              title: "관련 노트",
            },
            metadata: {
              reason: "비슷한 내용을 다룹니다.",
            },
          },
        ],
      },
      related_note_recommendation_execution_claims: {
        data: [],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [],
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getRelatedNotes] 관련 노트 파싱 실패",
      }),
    );
  });

  it("AI 추천 실행 상태 조회에 실패하면 운영 오류를 보고하고 실행 상태를 false로 반환한다", async () => {
    const dbError = new Error("recommendation execution query failed");

    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: null,
        error: dbError,
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [],
    });
    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_STATE_LOAD_FAILED,
      message: "Related Notes AI 추천 실행 상태 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXECUTION_STATE,
      context: {
        noteId,
      },
      userId: authenticatedUserId,
    });
  });

  it("AI 추천 실행 상태 응답이 유효하지 않으면 오류를 기록하고 실행 상태를 false로 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: createCurrentNoteResult(),
      profiles: createUserProfileResult(),
      note_related_notes: {
        data: [],
      },
      related_note_recommendation_execution_claims: {
        data: [
          {
            id: executionClaimId,
            status: "unknown",
          },
        ],
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: createAuthMock(),
      rpc: createRecommendationUsageRpcMock(),
    } as never);

    const result = await getRelatedNotes(noteId);

    expect(result).toEqual({
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationUsage: {
        used: 0,
        limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      },
      relatedNotes: [],
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getRelatedNotes] AI 추천 실행 상태 파싱 실패",
      }),
    );
    expect(reportRelatedNotesOperationalErrorMock).not.toHaveBeenCalled();
  });
});

describe("getRelatedNoteCandidates", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const relatedNoteId = "22222222-2222-4222-8222-222222222222";
  const candidateNoteId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockReset();
  });

  it("현재 Note와 기존 관계를 제외하고 Related Note 후보를 조회한다", async () => {
    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationEqMock = vi.fn().mockResolvedValue({
      data: [
        {
          note_id: noteId,
          related_note_id: relatedNoteId,
        },
      ],
      error: null,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      or: relationEqMock,
    });

    const candidateRangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: candidateNoteId,
          title: "후보 노트",
        },
      ],
      count: 1,
      error: null,
    });

    const candidateIlikeMock = vi.fn().mockReturnValue({
      range: candidateRangeMock,
    });

    const candidateOrderMock = vi.fn().mockReturnValue({
      ilike: candidateIlikeMock,
      range: candidateRangeMock,
    });

    const candidateNotMock = vi.fn().mockReturnValue({
      order: candidateOrderMock,
    });

    const candidateUserEqMock = vi.fn().mockReturnValue({
      not: candidateNotMock,
    });

    const candidateSelectMock = vi.fn().mockReturnValue({
      eq: candidateUserEqMock,
    });

    /*
     * getRelatedNoteCandidates는 notes를 두 번 조회합니다.
     *
     * 첫 번째 조회는 기준 Note의 소유권 확인,
     * 두 번째 조회는 실제 Related Note 후보 목록 조회입니다.
     */
    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: candidateSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    const result = await getRelatedNoteCandidates(noteId, 2, "후보", 8);

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      "user-123",
      getNoteDetailRoute(noteId),
    );

    expect(fromMock).toHaveBeenNthCalledWith(1, "notes");
    expect(sourceNoteEqMock).toHaveBeenCalledWith("id", noteId);
    expect(sourceUserEqMock).toHaveBeenCalledWith("user_id", "user-123");

    expect(fromMock).toHaveBeenNthCalledWith(2, "note_related_notes");
    expect(relationSelectMock).toHaveBeenCalledWith("note_id, related_note_id");
    expect(relationEqMock).toHaveBeenCalledWith(
      `note_id.eq.${noteId},related_note_id.eq.${noteId}`,
    );

    expect(fromMock).toHaveBeenNthCalledWith(3, "notes");
    expect(candidateUserEqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(candidateNotMock).toHaveBeenCalledWith(
      "id",
      "in",
      `(${noteId},${relatedNoteId})`,
    );
    expect(candidateIlikeMock).toHaveBeenCalledWith("title", "%후보%");
    expect(candidateRangeMock).toHaveBeenCalledWith(8, 15);

    expect(result).toEqual({
      notes: [
        {
          id: candidateNoteId,
          title: "후보 노트",
        },
      ],
      total: 1,
    });
  });

  it("현재 Note가 related_note_id인 기존 관계의 반대편 Note도 후보에서 제외한다", async () => {
    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationOrMock = vi.fn().mockResolvedValue({
      data: [
        {
          note_id: relatedNoteId,
          related_note_id: noteId,
        },
      ],
      error: null,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const candidateRangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: candidateNoteId,
          title: "후보 노트",
        },
      ],
      count: 1,
      error: null,
    });

    const candidateOrderMock = vi.fn().mockReturnValue({
      range: candidateRangeMock,
    });

    const candidateNotMock = vi.fn().mockReturnValue({
      order: candidateOrderMock,
    });

    const candidateUserEqMock = vi.fn().mockReturnValue({
      not: candidateNotMock,
    });

    const candidateSelectMock = vi.fn().mockReturnValue({
      eq: candidateUserEqMock,
    });

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: candidateSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    await getRelatedNoteCandidates(noteId);

    expect(candidateNotMock).toHaveBeenCalledWith(
      "id",
      "in",
      `(${noteId},${relatedNoteId})`,
    );
  });

  it("기준 Note DB 조회에 실패하면 운영 오류를 보고하고 기존처럼 throw한다", async () => {
    const dbError = new Error("source note query failed");

    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: dbError,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const fromMock = vi.fn().mockReturnValue({
      select: sourceSelectMock,
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: authenticatedUserId,
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    await expect(getRelatedNoteCandidates(noteId)).rejects.toBe(dbError);

    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.SOURCE_NOTE_LOAD_FAILED,
      message: "Related Note 후보 조회를 위한 기준 Note 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_SOURCE_NOTE,
      context: {
        noteId,
      },
      userId: authenticatedUserId,
    });
  });

  it("기존 관계 DB 조회에 실패하면 운영 오류를 보고하고 기존처럼 throw한다", async () => {
    const dbError = new Error("existing relation query failed");

    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationOrMock = vi.fn().mockResolvedValue({
      data: null,
      error: dbError,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: authenticatedUserId,
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    await expect(getRelatedNoteCandidates(noteId)).rejects.toBe(dbError);

    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTES_LOAD_FAILED,
      message: "Related Note 후보 제외를 위한 기존 관계 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTES,
      context: {
        noteId,
      },
      userId: authenticatedUserId,
    });
  });

  it("후보 Note 목록 DB 조회에 실패하면 운영 오류를 보고하고 기존처럼 throw한다", async () => {
    const dbError = new Error("candidate note query failed");

    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationOrMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const candidateRangeMock = vi.fn().mockResolvedValue({
      data: null,
      count: null,
      error: dbError,
    });

    const candidateIlikeMock = vi.fn().mockReturnValue({
      range: candidateRangeMock,
    });

    const candidateOrderMock = vi.fn().mockReturnValue({
      ilike: candidateIlikeMock,
      range: candidateRangeMock,
    });

    const candidateNotMock = vi.fn().mockReturnValue({
      order: candidateOrderMock,
    });

    const candidateUserEqMock = vi.fn().mockReturnValue({
      not: candidateNotMock,
    });

    const candidateSelectMock = vi.fn().mockReturnValue({
      eq: candidateUserEqMock,
    });

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: candidateSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: authenticatedUserId,
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    await expect(getRelatedNoteCandidates(noteId, 2, "후보", 8)).rejects.toBe(
      dbError,
    );

    expect(reportRelatedNotesOperationalErrorMock).toHaveBeenCalledWith({
      actorUserId: authenticatedUserId,
      error: dbError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTE_CANDIDATES_LOAD_FAILED,
      message: "Related Note 후보 목록 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTE_CANDIDATES,
      context: {
        noteId,
        page: 2,
        pageSize: 8,
        searchApplied: true,
      },
      userId: authenticatedUserId,
    });
  });

  it("후보 Note 응답이 유효하지 않으면 오류를 기록하고 빈 후보 목록을 반환한다", async () => {
    const sourceMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: noteId,
      },
      error: null,
    });

    const sourceUserEqMock = vi.fn().mockReturnValue({
      maybeSingle: sourceMaybeSingleMock,
    });

    const sourceNoteEqMock = vi.fn().mockReturnValue({
      eq: sourceUserEqMock,
    });

    const sourceSelectMock = vi.fn().mockReturnValue({
      eq: sourceNoteEqMock,
    });

    const relationOrMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const relationSelectMock = vi.fn().mockReturnValue({
      or: relationOrMock,
    });

    const candidateRangeMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "not-a-uuid",
          title: "후보 노트",
        },
      ],
      count: 1,
      error: null,
    });

    const candidateOrderMock = vi.fn().mockReturnValue({
      range: candidateRangeMock,
    });

    const candidateNotMock = vi.fn().mockReturnValue({
      order: candidateOrderMock,
    });

    const candidateUserEqMock = vi.fn().mockReturnValue({
      not: candidateNotMock,
    });

    const candidateSelectMock = vi.fn().mockReturnValue({
      eq: candidateUserEqMock,
    });

    const fromMock = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: sourceSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: relationSelectMock,
      }))
      .mockImplementationOnce(() => ({
        select: candidateSelectMock,
      }));

    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: authenticatedUserId,
            },
          },
        }),
      },
      from: fromMock,
    } as never);

    const result = await getRelatedNoteCandidates(noteId);

    expect(result).toEqual({
      notes: [],
      total: 0,
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getRelatedNoteCandidates] 후보 Note 파싱 실패",
      }),
    );
    expect(reportRelatedNotesOperationalErrorMock).not.toHaveBeenCalled();
  });

  it("인증된 사용자가 없으면 빈 후보 목록을 반환한다", async () => {
    const { supabase, from } = createSupabaseQueryMock({});

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
        }),
      },
    } as never);

    const result = await getRelatedNoteCandidates(noteId);

    expect(result).toEqual({
      notes: [],
      total: 0,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("기준 Note가 현재 사용자의 Note가 아니면 후보를 조회하지 않는다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: {
        data: null,
      },
    });

    createClientMock.mockResolvedValue({
      ...supabase,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
        }),
      },
    } as never);

    const result = await getRelatedNoteCandidates(noteId);

    expect(result).toEqual({
      notes: [],
      total: 0,
    });

    expect(callsFor("note_related_notes")).toEqual([]);
  });
});
