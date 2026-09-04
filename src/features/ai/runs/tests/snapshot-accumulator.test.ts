import { describe, expect, it, vi } from "vitest";

import { createAiRunSnapshotAccumulator } from "../snapshot-accumulator";

/** 테스트에서 사용하는 기능별 mutable 상태입니다. */
type TestSnapshotState = {
  schemaVersion: 1;
  value?: string;
};

describe("createAiRunSnapshotAccumulator", () => {
  it("mutation 중에는 build를 실행하지 않고 현재 상태만 갱신한다", () => {
    const buildSnapshot = vi.fn((state: TestSnapshotState) => ({ ...state }));
    const accumulator = createAiRunSnapshotAccumulator<TestSnapshotState>(
      { schemaVersion: 1 },
      buildSnapshot,
    );

    accumulator.mutate((state) => {
      state.value = "관측값";
    });

    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(accumulator.buildSnapshot()).toEqual({
      schemaVersion: 1,
      value: "관측값",
    });
    expect(buildSnapshot).toHaveBeenCalledOnce();
  });

  it("서로 다른 accumulator의 상태를 공유하지 않는다", () => {
    const first = createAiRunSnapshotAccumulator(
      { schemaVersion: 1, values: [] as string[] },
      (state) => ({ ...state }),
    );
    const second = createAiRunSnapshotAccumulator(
      { schemaVersion: 1, values: [] as string[] },
      (state) => ({ ...state }),
    );

    first.mutate((state) => {
      state.values.push("first");
    });

    expect(first.buildSnapshot()).toEqual({
      schemaVersion: 1,
      values: ["first"],
    });
    expect(second.buildSnapshot()).toEqual({ schemaVersion: 1, values: [] });
  });
});
