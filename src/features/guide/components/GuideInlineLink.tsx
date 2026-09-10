import Link from "next/link";

import { getGuideRoute } from "@/lib/constants/routes";

import { findGuideDocument, isPublishedGuide } from "../content";

/**
 * 랜딩 등 다른 화면에서 가이드로 나가는 내부 링크.
 *
 * 본문이 아직 없는 문서로는 아무것도 그리지 않는다. 게이트를 이 컴포넌트 한 곳에
 * 모아 두면, 문서를 공개할 때 `revisedOn`만 채워도 링크가 함께 살아난다.
 *
 * 앵커 텍스트는 호출부가 문장으로 넘긴다. "자세히 보기" 같은 앵커는 링크를 누르기
 * 전에 어떤 페이지인지 알 수 없어 쓰지 않는다.
 */
export function GuideInlineLink({
  slug,
  label,
  className,
}: {
  slug: string;
  label: string;
  className?: string;
}) {
  const document = findGuideDocument(slug);

  if (!document || !isPublishedGuide(document)) {
    return null;
  }

  return (
    <Link
      href={getGuideRoute(document.slug)}
      className={`cursor-pointer underline underline-offset-4 transition-colors hover:text-foreground ${className ?? ""}`}
    >
      {label}
    </Link>
  );
}
