import Link from "next/link";

import { getPublishedGuideDocuments } from "@/features/guide/content";
import { LEGAL_CONTACT } from "@/lib/constants/legal";
import { ROUTES } from "@/lib/constants/routes";

const footerLinks = [
  /* 앵커는 랜딩에만 있는데 이 푸터는 (legal) 레이아웃에도 붙는다. "#faq"처럼
     경로 없이 두면 /terms에서 /terms#faq로 이동해 아무 데도 가지 않는다.
     경로를 붙여 어느 페이지에서 눌러도 랜딩의 해당 섹션으로 가게 한다. */
  {
    title: "서비스",
    links: [
      { label: "자주 묻는 질문", href: `${ROUTES.HOME}#faq` },
      { label: "기능 소개", href: `${ROUTES.HOME}#features` },
      /* 푸터는 모든 페이지에 붙어서 가이드로 가는 사이트 전역 내부 링크가 된다.
         다만 읽을 문서가 하나도 없는 동안에는 준비 중인 목록으로 보내게 되므로,
         첫 문서가 공개된 뒤부터 노출한다. */
      ...(getPublishedGuideDocuments().length > 0
        ? [{ label: "학습 가이드", href: ROUTES.GUIDE }]
        : []),
    ],
  },
  {
    title: "법적 고지",
    links: [
      { label: "이용약관", href: ROUTES.TERMS },
      { label: "개인정보처리방침", href: ROUTES.PRIVACY },
    ],
  },
  /* 운영 주체와 연락 경로는 약관·개인정보 처리방침 안에만 있어서, 그 문서를
     펼치기 전에는 누가 만들고 어디로 문의하는지 알 수 없었다. 모든 페이지에
     붙는 푸터에 같은 값(LEGAL_CONTACT)으로 한 번 더 노출한다. */
  {
    title: "문의",
    links: [{ label: "이메일 문의", href: `mailto:${LEGAL_CONTACT.email}` }],
  },
] as const;

/* 배포 서버는 UTC라 new Date().getFullYear()를 그대로 쓰면 1월 1일 KST
   새벽 9시간 동안 전년도가 찍힌다. 다른 날짜 표기와 같이 KST로 고정한다. */
const yearFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "Asia/Seoul",
});

export function Footer() {
  const currentYear = yearFormatter.format(new Date());

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 pb-6 pt-8 md:pt-10">
        {/* 열 수는 링크 그룹 수에 맞춘다. 4열로 두면 그룹이 셋뿐이라 마지막
            한 칸이 비고 링크가 왼쪽으로 쏠린다. 그룹을 늘리거나 줄이면 이
            값도 함께 고친다. */}
        <nav
          aria-label="푸터 링크"
          className="grid grid-cols-2 gap-8 sm:grid-cols-3"
        >
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-8 border-t pt-5">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {currentYear} 딱다구리. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
