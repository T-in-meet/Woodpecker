type AuthFormHeaderProps = {
  title: string;
  description?: React.ReactNode;
};

/**
 * Auth 페이지의 공통 제목과 선택 설명을 표시합니다.
 *
 * 제목과 설명의 typography 및 간격을 통일하며,
 * validation 또는 server error 메시지는 이 영역에 표시하지 않습니다.
 */
export function AuthFormHeader({ title, description }: AuthFormHeaderProps) {
  return (
    <div className="mb-6 space-y-2">
      {/* Auth 페이지의 제목과 선택 설명을 동일한 스타일과 간격으로 표시한다. */}
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        {title}
      </h1>

      {description ? (
        <div className="text-sm text-muted-foreground">{description}</div>
      ) : null}
    </div>
  );
}
