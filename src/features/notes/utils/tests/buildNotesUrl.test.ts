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

  it("상태별 보기는 view 파라미터를 유지한다", () => {
    expect(buildNotesUrl({ query: "복습", page: 2, view: "due" })).toBe(
      "/notes?q=%EB%B3%B5%EC%8A%B5&view=due&page=2",
    );
  });

  it("전체 보기는 기본값이므로 view 파라미터를 생략한다", () => {
    expect(buildNotesUrl({ view: "all" })).toBe("/notes");
  });

  it("query trim 후 빈 문자열이면 q 생략", () => {
    expect(buildNotesUrl({ query: "" })).toBe("/notes");
  });
});
