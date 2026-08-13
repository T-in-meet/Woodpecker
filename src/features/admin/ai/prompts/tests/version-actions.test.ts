import { describe, expect, it } from "vitest";

import { getAdminAiPromptVersionActions } from "../utils/version-actions";

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
