import Link from "next/link";

import { LEGAL_CONTACT } from "@/lib/constants/legal";
import { ROUTES } from "@/lib/constants/routes";

const footerLinks = [
  {
    title: "서비스",
    links: [
      { label: "자주 묻는 질문", href: "#faq" },
      { label: "기능 소개", href: "#features" },
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

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      {/*
        위쪽 여백은 앞 섹션과 푸터를 떼어놓는 역할이 있어 유지하고, 아래는
        따라올 내용이 없으므로 줄인다. 상하를 같게 두면 카피라이트 아래가
        빈 공간으로 남는다.
      */}
      <div className="mx-auto max-w-5xl px-6 pb-8 pt-12 md:pb-10 md:pt-16">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Link groups */}
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
        </div>

        <div className="mt-10 border-t pt-6">
          {/* <p className="text-center text-xs text-muted-foreground">
            운영: {LEGAL_CONTACT.department}
          </p> */}
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            &copy; 2026 딱다구리. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
