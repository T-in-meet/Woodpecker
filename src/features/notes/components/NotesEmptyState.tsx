type NotesEmptyStateProps = {
  query: string;
};

export function NotesEmptyState({ query }: NotesEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <p className="text-base font-medium text-foreground">
        {query
          ? `"${query}"에 대한 검색 결과가 없습니다.`
          : "아직 저장한 노트가 없습니다."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {query
          ? "다른 검색어를 입력해보세요."
          : "첫 노트를 작성하고 복습 흐름을 시작해보세요."}
      </p>
    </div>
  );
}
