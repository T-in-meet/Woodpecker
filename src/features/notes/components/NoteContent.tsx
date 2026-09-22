import { renderNoteHtml } from "@/features/editor/utils/renderNoteHtml";
import { cn } from "@/lib/utils/cn";

type NoteContentProps = {
  content: string;
  className?: string;
};

/**
 * 노트 본문을 서버에서 HTML로 렌더하는 읽기 전용 뷰. 클라이언트 TipTap 없이
 * 서버 응답에 본문이 실리므로 상세 화면의 LCP가 에디터 생성에 묶이지 않는다.
 *
 * 마크업은 TipTapEditor의 읽기 전용 출력과 같은 셀렉터(.tiptap-wrapper .tiptap,
 * [contenteditable="false"])를 유지해 tiptap.css를 그대로 적용받는다.
 *
 * dangerouslySetInnerHTML의 HTML은 우리 스키마의 DOMSerializer 출력이다. 임의 HTML은
 * 스키마에 없어 통과하지 못하고, 링크·이미지 주소는 확장의 isSafeLinkHref·
 * normalizeImageSrc가 걸러내므로 클라이언트가 렌더하던 것과 안전 수준이 같다.
 */
export function NoteContent({ content, className }: NoteContentProps) {
  if (!content) {
    return (
      <div className={cn("py-6 text-muted-foreground/40", className)}>
        미리보기할 내용이 없습니다.
      </div>
    );
  }

  const html = renderNoteHtml(content);

  return (
    <div
      className={cn(
        "tiptap-wrapper relative overflow-hidden rounded-md bg-background text-base",
        // 배경 블록은 좌우로 0.375rem 삐져나오게 만들어져 있다(tiptap.css).
        // 좌우 패딩이 0이면 그만큼이 wrapper의 overflow-hidden에 잘려 모서리가 각지므로,
        // 같은 크기의 패딩을 주고 wrapper를 그만큼 당겨 글자 위치는 그대로 둔다.
        "-mx-1.5 [&_.tiptap]:px-1.5! [&_.tiptap]:py-6! sm:[&_.tiptap]:px-1.5!",
        className,
      )}
    >
      <div
        className="tiptap ProseMirror"
        contentEditable={false}
        translate="no"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
