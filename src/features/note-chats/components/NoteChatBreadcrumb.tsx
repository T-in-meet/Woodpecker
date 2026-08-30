import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTES } from "@/lib/constants/routes";

type NoteChatBreadcrumbProps = {
  /** Breadcrumb에 추가할 외부 스타일입니다. */
  className?: string;

  /** 상세 화면에서 표시할 현재 Conversation 제목입니다. */
  conversationTitle?: string;
};

/**
 * 노트 챗봇 목록과 Conversation 상세 화면에서 사용하는 Breadcrumb입니다.
 *
 * Conversation 제목이 없으면 노트 챗봇 목록을 현재 페이지로 표시하고,
 * 제목이 있으면 노트 챗봇 목록 링크와 현재 Conversation 제목을 표시합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.className Breadcrumb에 추가할 외부 스타일
 * @param props.conversationTitle 현재 Conversation 제목
 * @returns 노트 챗봇 Breadcrumb UI
 */
export function NoteChatBreadcrumb({
  className,
  conversationTitle,
}: NoteChatBreadcrumbProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={ROUTES.HOME}>홈</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {conversationTitle ? (
            <BreadcrumbLink asChild>
              <Link href={ROUTES.NOTE_CHATS}>노트 챗봇</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="font-medium">노트 챗봇</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {conversationTitle ? (
          <>
            <BreadcrumbSeparator />

            <BreadcrumbItem>
              <BreadcrumbPage
                className="max-w-45 truncate font-medium sm:max-w-xs"
                title={conversationTitle}
              >
                {conversationTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
