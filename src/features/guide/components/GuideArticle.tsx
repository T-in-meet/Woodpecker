import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { parseHeadingAnchor } from "../lib/headingAnchor";
import type { GuideHeading } from "../lib/prepareGuideMarkdown";
import { GuideToc } from "./GuideToc";

/**
 * 제목 children이 순수 텍스트일 때만 문자열로 되돌린다.
 *
 * 앵커 표기(`{#id}`)는 제목 전체가 한 덩어리 텍스트일 때만 의미가 있다. 링크나
 * 강조가 섞인 제목은 파싱하지 않고 그대로 그린다.
 */
function toPlainText(children: ReactNode): string | null {
  if (typeof children === "string") {
    return children;
  }

  if (
    Array.isArray(children) &&
    children.every((child) => typeof child === "string")
  ) {
    return children.join("");
  }

  return null;
}

function Heading2({ children }: { children?: ReactNode }) {
  const raw = toPlainText(children);

  if (raw === null) {
    return <h2>{children}</h2>;
  }

  const { text, id } = parseHeadingAnchor(raw);

  /* 헤더가 sticky top-0이라 앵커로 이동하면 제목이 그 아래로 들어간다.
     `/guide` 인덱스의 #about 섹션과 같은 값으로 스크롤 여백을 준다. */
  return (
    <h2 id={id} className={id ? "scroll-mt-24" : undefined}>
      {text}
    </h2>
  );
}

/**
 * 문서 사이 링크는 next/link로 넘긴다.
 *
 * 마크다운이 만드는 `<a>`를 그대로 두면 가이드 사이를 오갈 때마다 전체 페이지가
 * 다시 로드된다. 세 문서가 서로를 참조하는 구조라 이동이 잦다.
 */
function GuideLink({
  href,
  children,
}: {
  href?: string | undefined;
  children?: ReactNode;
}) {
  if (href?.startsWith("/")) {
    return <Link href={href}>{children}</Link>;
  }

  return <a href={href}>{children}</a>;
}

/**
 * 제목 아래 작성자·수정일 한 줄. `GuideHero`의 `children` 자리에 들어간다.
 *
 * 본문(`GuideArticle`)과 떼어 둔 이유는 H1이 히어로 밴드 안에 있기 때문이다.
 * 메타는 제목 바로 아래 붙어야 읽히므로 본문이 아니라 히어로를 따라간다.
 */
export function GuideArticleMeta({
  author,
  revisedOn,
}: {
  author: { name: string; href: string };
  revisedOn: string | null;
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <span>
        작성:{" "}
        <Link
          href={author.href}
          className="cursor-pointer underline underline-offset-4"
        >
          {author.name}
        </Link>
      </span>
      {revisedOn && (
        <span>
          · 최종 수정:{" "}
          <time dateTime={revisedOn}>{revisedOn.replaceAll("-", ".")}</time>
        </span>
      )}
    </p>
  );
}

/**
 * 가이드 본문(마크다운)과 차례를 렌더링한다.
 *
 * H1은 페이지가 `GuideHero`로 그리고 마크다운은 H2부터 시작한다. 제목 계층을 한
 * 곳에서 정하기 위해서다. 본문 파일에도 H1을 두면 문서마다 H1이 둘이 되거나
 * 화면의 제목과 문서의 제목이 갈라진다.
 *
 * `markdown`은 `prepareGuideMarkdown`을 거친 문자열이어야 한다. 모든 H2에 id가
 * 붙어 있어야 `headings`로 그리는 차례가 절로 이동한다.
 */
export function GuideArticle({
  markdown,
  headings,
}: {
  markdown: string;
  headings: readonly GuideHeading[];
}) {
  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      {/* sticky는 aside에 건다. 안쪽 요소에 걸면 aside 높이(=내용 높이) 안에서만
          움직여 제자리에 고정된다. aside가 grid 항목이면 본문 전체 높이가 기준이 된다. */}
      <aside className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
        <GuideToc headings={headings} />
      </aside>
      <div className="prose prose-stone mt-6 max-w-none text-prose-ko lg:mt-0">
        {/* 표는 GFM 문법이라 remark-gfm 없이는 파이프 문자가 그대로 나온다.
            자동 링크와 취소선도 같은 플러그인이 담당한다. */}
        <ReactMarkdown
          components={{ a: GuideLink, h2: Heading2 }}
          remarkPlugins={[remarkGfm]}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
