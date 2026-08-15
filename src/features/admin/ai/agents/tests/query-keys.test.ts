import { describe, expect, it } from "vitest";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../constants/query-keys";

describe("ADMIN_AI_AGENTS_QUERY_KEY", () => {
  it("options key는 Agent query namespace를 재사용한다", () => {
    expect(ADMIN_AI_AGENTS_QUERY_KEY.options).toEqual([
      ...ADMIN_AI_AGENTS_QUERY_KEY.all,
      "options",
    ]);
  });
});
