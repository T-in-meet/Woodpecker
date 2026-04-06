import { afterEach, describe, expect, it } from "vitest";

import { getBlockHandleMarkerOffset } from "../components/BlockHandleMenu";

describe("getBlockHandleMarkerOffset", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds the parent list padding for standard unordered lists", () => {
    const listElement = document.createElement("ul");
    listElement.style.paddingLeft = "28px";

    const itemElement = document.createElement("li");
    listElement.appendChild(itemElement);
    document.body.appendChild(listElement);

    expect(getBlockHandleMarkerOffset(itemElement)).toBe(34);
  });

  it("ignores task list items", () => {
    const listElement = document.createElement("ul");
    listElement.dataset.type = "taskList";
    listElement.style.paddingLeft = "28px";

    const itemElement = document.createElement("li");
    listElement.appendChild(itemElement);
    document.body.appendChild(listElement);

    expect(getBlockHandleMarkerOffset(itemElement)).toBe(0);
  });

  it("ignores non-list blocks", () => {
    const paragraphElement = document.createElement("p");
    document.body.appendChild(paragraphElement);

    expect(getBlockHandleMarkerOffset(paragraphElement)).toBe(0);
  });
});
