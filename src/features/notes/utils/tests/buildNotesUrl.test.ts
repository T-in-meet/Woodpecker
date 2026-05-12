import { describe, expect, it } from "vitest";

import { buildNotesUrl } from "../buildNotesUrl";

describe("buildNotesUrl", () => {
  it("파라미터 없으면 /notes 반환", () => {
    expect(buildNotesUrl({})).toBe("/notes");
  });

  it("query만 있으면 q 파라미터 추가", () => {
    expect(buildNotesUrl({ query: "hello" })).toBe("/notes?q=hello");
  });

  it("query 공백만이면 q 파라미터 생략", () => {
    expect(buildNotesUrl({ query: "   " })).toBe("/notes");
  });

  it("page=1은 기본값이므로 파라미터 생략", () => {
    expect(buildNotesUrl({ page: 1 })).toBe("/notes");
  });

  it("page>1이면 page 파라미터 추가", () => {
    expect(buildNotesUrl({ page: 3 })).toBe("/notes?page=3");
  });

  it("query + page 조합", () => {
    const url = buildNotesUrl({ query: "리액트", page: 2 });
    expect(url).toBe("/notes?q=%EB%A6%AC%EC%95%A1%ED%8A%B8&page=2");
  });

  it("query trim 후 빈 문자열이면 q 생략", () => {
    expect(buildNotesUrl({ query: "" })).toBe("/notes");
  });

  it("view=list이면 view 파라미터 생략 (기본값)", () => {
    expect(buildNotesUrl({ view: "list" })).toBe("/notes");
  });

  it("view=cards이면 view 파라미터 추가", () => {
    expect(buildNotesUrl({ view: "cards" })).toBe("/notes?view=cards");
  });

  it("query + view=cards 조합", () => {
    expect(buildNotesUrl({ query: "hello", view: "cards" })).toBe(
      "/notes?q=hello&view=cards",
    );
  });
});
