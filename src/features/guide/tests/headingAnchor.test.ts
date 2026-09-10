import { describe, expect, it } from "vitest";

import { parseHeadingAnchor } from "../lib/headingAnchor";

describe("parseHeadingAnchor", () => {
  it("제목 끝의 {#id} 표기를 앵커 id로 분리한다", () => {
    expect(
      parseHeadingAnchor("무엇을 반복해야 할까 {#retrieval-practice}"),
    ).toEqual({
      text: "무엇을 반복해야 할까",
      id: "retrieval-practice",
    });
  });

  it("앵커 표기가 없으면 id를 붙이지 않는다", () => {
    expect(parseHeadingAnchor("복습은 언제 끝낼까")).toEqual({
      text: "복습은 언제 끝낼까",
    });
  });

  it("한국어 제목에서 id를 자동 생성하지 않는다", () => {
    expect(parseHeadingAnchor("복습은 언제 끝낼까").id).toBeUndefined();
  });

  it("앵커 표기가 중간에 있으면 분리하지 않는다", () => {
    expect(parseHeadingAnchor("{#not-anchor} 제목")).toEqual({
      text: "{#not-anchor} 제목",
    });
  });
});
