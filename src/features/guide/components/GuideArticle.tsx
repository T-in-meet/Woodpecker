import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { parseHeadingAnchor } from "../lib/headingAnchor";

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

  return <h2 id={id}>{text}</h2>;
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
 * 가이드 본문(마크다운)을 렌더링한다.
 *
 * H1은 넘겨받은 `heading`으로 그리고 마크다운은 H2부터 시작한다. 제목 계층을 한
 * 곳에서 정하기 위해서다. 본문 파일에도 H1을 두면 문서마다 H1이 둘이 되거나
 * 화면의 제목과 문서의 제목이 갈라진다.
 */
export function GuideArticle({
  heading,
  markdown,
  author,
  revisedOn,
}: {
  heading: string;
  markdown: string;
  author: { name: string; href: string };
  revisedOn: string | null;
}) {
  return (
    <article className="text-prose-ko">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
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
      <div className="prose prose-stone mt-8 max-w-none">
        {/* 표는 GFM 문법이라 remark-gfm 없이는 파이프 문자가 그대로 나온다.
            자동 링크와 취소선도 같은 플러그인이 담당한다. */}
        <ReactMarkdown
          components={{ a: GuideLink, h2: Heading2 }}
          remarkPlugins={[remarkGfm]}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
