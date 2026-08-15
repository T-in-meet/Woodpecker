import { describe, expect, it } from "vitest";

import {
  getAdminAiPromptVersionActions,
  getAdminAiPromptVersionEditPolicy,
} from "../utils/version-actions";

describe("getAdminAiPromptVersionActions", () => {
  it("Draft Version에 Publish와 삭제를 허용한다", () => {
    expect(getAdminAiPromptVersionActions("draft")).toEqual([
      "publish",
      "delete",
    ]);
  });

  it("Published Version에 Archive만 허용한다", () => {
    expect(getAdminAiPromptVersionActions("published")).toEqual(["archive"]);
  });

  it("Archived Version에 Republish와 삭제를 허용한다", () => {
    expect(getAdminAiPromptVersionActions("archived")).toEqual([
      "republish",
      "delete",
    ]);
  });
});

describe("getAdminAiPromptVersionEditPolicy", () => {
  it("Draft Version은 Template과 관리 필드 수정을 허용한다", () => {
    expect(getAdminAiPromptVersionEditPolicy("draft")).toEqual({
      canEditMetadata: true,
      canEditTemplate: true,
    });
  });

  it("Published Version은 관리 필드 수정만 허용한다", () => {
    expect(getAdminAiPromptVersionEditPolicy("published")).toEqual({
      canEditMetadata: true,
      canEditTemplate: false,
    });
  });

  it("Archived Version은 모든 수정을 금지한다", () => {
    expect(getAdminAiPromptVersionEditPolicy("archived")).toEqual({
      canEditMetadata: false,
      canEditTemplate: false,
    });
  });
});
