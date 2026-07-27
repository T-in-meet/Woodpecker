import type { ReactNode } from "react";

interface Props {
  title: string;

  description?: string;

  children: ReactNode;
}

/**
 * Component Playground에서 각 컴포넌트 실험 영역을 구분하는 공통 섹션이다.
 *
 * Playground에서 사용하는 컴포넌트마다 동일한 제목, 설명, 여백을
 * 일관되게 적용하기 위해 사용한다.
 */
export function AdminComponentPlaygroundSection({
  title,
  description,
  children,
}: Props) {
  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>

        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}
