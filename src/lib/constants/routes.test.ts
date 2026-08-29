import { describe, expect, it } from "vitest";

import {
  getAdminAiAgentRoute,
  getAdminAiModelRoute,
  getAdminAiPromptFamilyRoute,
  getAdminAiPromptVersionNewRoute,
  getAdminAiPromptVersionRoute,
  getAdminAiSettingsRoute,
  getNoteDetailRoute,
  getNoteReviewRoute,
  isCurrentNavRoute,
  ROUTES,
} from "./routes";

describe("routes", () => {
  it("builds note detail and review routes", () => {
    expect(getNoteDetailRoute("note-123")).toBe("/notes/note-123");
    expect(getNoteReviewRoute("note-123")).toBe("/notes/note-123/review");
  });

  describe("isCurrentNavRoute", () => {
    it("노트 목록은 상세 등 하위 경로까지 현재 항목으로 본다", () => {
      expect(isCurrentNavRoute("/notes", ROUTES.NOTES)).toBe(true);
      expect(isCurrentNavRoute("/notes/note-123", ROUTES.NOTES)).toBe(true);
      expect(isCurrentNavRoute("/notes?view=due", ROUTES.NOTES)).toBe(true);
    });

    it("노트 작성과 노트 챗봇은 노트 목록으로 보지 않는다", () => {
      expect(isCurrentNavRoute(ROUTES.NOTES_NEW, ROUTES.NOTES)).toBe(false);
      expect(isCurrentNavRoute(ROUTES.NOTE_CHATS, ROUTES.NOTES)).toBe(false);
    });

    it("노트 챗봇은 하위 경로까지 현재 항목으로 본다", () => {
      expect(isCurrentNavRoute(ROUTES.NOTE_CHATS, ROUTES.NOTE_CHATS)).toBe(
        true,
      );
      expect(isCurrentNavRoute("/note-chats/conv-123", ROUTES.NOTE_CHATS)).toBe(
        true,
      );
      expect(isCurrentNavRoute("/notes", ROUTES.NOTE_CHATS)).toBe(false);
    });

    it("그 외 항목은 정확히 일치할 때만 현재 항목으로 본다", () => {
      expect(isCurrentNavRoute(ROUTES.NOTES_NEW, ROUTES.NOTES_NEW)).toBe(true);
      expect(isCurrentNavRoute("/notes/note-123", ROUTES.NOTES_NEW)).toBe(
        false,
      );
    });
  });

  it("관리자 AI 모델 상세 페이지 경로를 생성한다", () => {
    expect(getAdminAiModelRoute("model-123")).toBe(
      "/admin/ai/models/model-123",
    );
  });

  it("관리자 AI 에이전트 상세 페이지 경로를 생성한다", () => {
    expect(getAdminAiAgentRoute("agent-123")).toBe(
      "/admin/ai/agents/agent-123",
    );
  });

  it("관리자 AI 프롬프트 패밀리 상세 페이지 경로를 생성한다", () => {
    expect(getAdminAiPromptFamilyRoute("family-123")).toBe(
      "/admin/ai/prompts/family-123",
    );
  });

  it("관리자 AI 프롬프트 버전 생성 페이지 경로를 생성한다", () => {
    expect(getAdminAiPromptVersionNewRoute("family-123")).toBe(
      "/admin/ai/prompts/family-123/versions/new",
    );
  });

  it("복사 원본 Version ID가 있는 관리자 AI 프롬프트 버전 생성 페이지 경로를 생성한다", () => {
    expect(getAdminAiPromptVersionNewRoute("family-123", "version-123")).toBe(
      "/admin/ai/prompts/family-123/versions/new?sourceVersionId=version-123",
    );
  });

  it("관리자 AI 프롬프트 버전 상세 페이지 경로를 생성한다", () => {
    expect(getAdminAiPromptVersionRoute("family-123", "version-123")).toBe(
      "/admin/ai/prompts/family-123/versions/version-123",
    );
  });

  it("관리자 AI 설정 상세 페이지 경로를 생성한다", () => {
    expect(getAdminAiSettingsRoute("setting-123")).toBe(
      "/admin/ai/settings/setting-123",
    );
  });
});
