import { cn } from "@/lib/utils/cn";

/** TipTapEditor 바깥 틀. 로딩 대체 화면도 같은 클래스를 써야 크기가 어긋나지 않는다. */
export const TIPTAP_WRAPPER_CLASS_NAME =
  "tiptap-wrapper relative overflow-hidden rounded-md border border-border bg-background text-base transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20";

// 에디터는 클라이언트에서 생성되므로 서버 HTML의 본문 영역이 비어 LCP가 에디터 생성을 기다린다.
// Placeholder 확장이 만드는 빈 문단과 같은 마크업을 먼저 그려 같은 CSS로 같은 크기를 유지한다.
export function TipTapEditorPlaceholder({
  placeholder,
}: {
  placeholder: string;
}) {
  return (
    <div className="tiptap" aria-hidden="true" data-static-placeholder="">
      <p className="is-editor-empty" data-placeholder={placeholder}>
        <br className="ProseMirror-trailingBreak" />
      </p>
    </div>
  );
}

type TipTapEditorShellProps = {
  placeholder: string;
  className?: string;
  onPointerDown?: () => void;
};

/** 에디터 번들을 받기 전까지 보여주는 틀과 placeholder. */
export function TipTapEditorShell({
  placeholder,
  className,
  onPointerDown,
}: TipTapEditorShellProps) {
  return (
    <div
      className={cn(TIPTAP_WRAPPER_CLASS_NAME, className)}
      onPointerDown={onPointerDown}
    >
      <TipTapEditorPlaceholder placeholder={placeholder} />
    </div>
  );
}
