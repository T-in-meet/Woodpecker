import { vi } from "vitest";

type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type ResolvedQueryResult = {
  data: unknown;
  error: unknown;
  count: number | null;
};

export type RecordedCall = [method: string, args: unknown[]];

type QueryBuilderMock = PromiseLike<ResolvedQueryResult> &
  Record<string, (...args: unknown[]) => unknown>;

// 체인 모양(메서드 순서·개수)에 의존하지 않는 쿼리 빌더 mock.
// 모든 메서드 호출을 calls에 기록하고 자기 자신을 반환하며, await 시 result를 resolve한다.
// 쿼리에 .range()·.limit() 등이 추가·제거돼도 mock이 깨지지 않도록
// 테스트는 체인 순서 대신 "어떤 메서드가 어떤 인자로 호출됐는가"를 검증한다.
function createQueryBuilderMock(result: QueryResult) {
  const calls: RecordedCall[] = [];
  const resolved: ResolvedQueryResult = {
    data: null,
    error: null,
    count: null,
    ...result,
  };

  const builder: QueryBuilderMock = new Proxy({} as QueryBuilderMock, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop === "then") {
        return (
          onFulfilled?: (value: ResolvedQueryResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(resolved).then(onFulfilled, onRejected);
      }
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        return builder;
      };
    },
  });

  return { builder, calls };
}

// 테이블별 결과를 지정해 supabase 클라이언트 mock을 생성한다.
// 같은 테이블을 여러 번 조회하면 호출 기록이 하나의 calls 배열에 누적된다.
export function createSupabaseQueryMock(
  resultsByTable: Record<string, QueryResult>,
) {
  const builders = new Map(
    Object.entries(resultsByTable).map(([table, result]) => [
      table,
      createQueryBuilderMock(result),
    ]),
  );

  const from = vi.fn((table: string) => {
    const existingBuilder = builders.get(table);

    if (existingBuilder) {
      return existingBuilder.builder;
    }

    const fallbackBuilder = createQueryBuilderMock({});
    builders.set(table, fallbackBuilder);

    return fallbackBuilder.builder;
  });

  return {
    supabase: { from },
    from,
    callsFor: (table: string): RecordedCall[] =>
      builders.get(table)?.calls ?? [],
  };
}
