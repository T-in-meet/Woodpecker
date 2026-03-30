import { describe, expect, it } from "vitest";

import { toggleMarkdownTaskItem } from "../utils/toggleMarkdownTaskItem";

describe("toggleMarkdownTaskItem", () => {
  it("checks the requested unchecked task item", () => {
    expect(toggleMarkdownTaskItem("- [ ] first\n- [ ] second", 1)).toBe(
      "- [ ] first\n- [x] second",
    );
  });

  it("unchecks checked task items across supported list markers", () => {
    const content = "* [X] alpha\n+ [x] beta\n- [x] gamma";

    expect(toggleMarkdownTaskItem(content, 0)).toBe(
      "* [ ] alpha\n+ [x] beta\n- [x] gamma",
    );
    expect(toggleMarkdownTaskItem(content, 1)).toBe(
      "* [X] alpha\n+ [ ] beta\n- [x] gamma",
    );
    expect(toggleMarkdownTaskItem(content, 2)).toBe(
      "* [X] alpha\n+ [x] beta\n- [ ] gamma",
    );
  });

  it("toggles ordered task list items", () => {
    const content = "1. [ ] first\n2. [x] second";

    expect(toggleMarkdownTaskItem(content, 0)).toBe(
      "1. [x] first\n2. [x] second",
    );
    expect(toggleMarkdownTaskItem(content, 1)).toBe(
      "1. [ ] first\n2. [ ] second",
    );
  });

  it("preserves nested indentation and returns the original content when the index is missing", () => {
    const content = "  - [ ] nested item";

    expect(toggleMarkdownTaskItem(content, 0)).toBe("  - [x] nested item");
    expect(toggleMarkdownTaskItem(content, 3)).toBe(content);
  });
});
