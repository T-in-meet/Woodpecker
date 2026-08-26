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
} from "./routes";

describe("routes", () => {
  it("builds note detail and review routes", () => {
    expect(getNoteDetailRoute("note-123")).toBe("/notes/note-123");
    expect(getNoteReviewRoute("note-123")).toBe("/notes/note-123/review");
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
