import type { AiRunSnapshotBuilder } from "./types";

/** 한 실행의 메모리 상태와 Snapshot build 경계를 관리하는 accumulator입니다. */
export type AiRunSnapshotAccumulator<TState> = {
  /** 현재 메모리 상태를 기능별 schema로 build하고 검증합니다. */
  buildSnapshot: AiRunSnapshotBuilder;

  /** 전체 Snapshot validation 없이 현재 실행 상태를 갱신합니다. */
  mutate: (mutation: (state: TState) => void) => void;
};

/**
 * 한 AI 실행에서만 사용하는 mutable Snapshot accumulator를 생성합니다.
 *
 * 공통 계층은 기능별 필드를 해석하지 않으며, 기능 계층이 제공한 builder만
 * create/checkpoint/terminal 경계에서 실행할 수 있도록 노출합니다.
 *
 * @param initialState 실행 시작 시점의 기능별 메모리 상태
 * @param buildSnapshot 현재 상태를 기능별 schema로 검증하는 함수
 * @returns 메모리 mutation과 Snapshot build 책임이 분리된 accumulator
 */
export function createAiRunSnapshotAccumulator<TState>(
  initialState: TState,
  buildSnapshot: (state: TState) => unknown,
): AiRunSnapshotAccumulator<TState> {
  // 실행별 상태는 이 closure 안에서만 유지하고 DB나 전역 상태와 공유하지 않는다.
  const state = initialState;

  return {
    buildSnapshot: () => buildSnapshot(state),
    mutate: (mutation) => {
      // 단계 관측값 기록 중에는 전체 문서 clone이나 schema validation을 수행하지 않는다.
      mutation(state);
    },
  };
}
