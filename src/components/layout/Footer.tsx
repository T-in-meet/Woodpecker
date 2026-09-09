import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";

const footerLinks = [
  {
    title: "서비스",
    links: [
      { label: "자주 묻는 질문", href: `${ROUTES.HOME}#faq` },
      { label: "기능 소개", href: `${ROUTES.HOME}#features` },
    ],
  },
  {
    title: "법적 고지",
    links: [
      { label: "이용약관", href: ROUTES.TERMS },
      { label: "개인정보처리방침", href: ROUTES.PRIVACY },
    ],
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
        <nav
          aria-label="푸터 링크"
          className="grid grid-cols-2 gap-8 md:grid-cols-4"
        >
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
