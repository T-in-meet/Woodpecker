import { describe, expect, it } from "vitest";

import { createNoteAction } from "../actions";

describe("createNoteAction", () => {
  it("유효하지 않은 데이터에 에러를 반환한다", async () => {
    const formData = new FormData();
    formData.set("title", "");
    formData.set("content", "");

    const result = await createNoteAction(null, formData);
    expect(result?.error).toBeDefined();
  });
});
