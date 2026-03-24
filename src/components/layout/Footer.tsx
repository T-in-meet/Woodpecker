import Link from "next/link";

const footerLinks = [
  {
    title: "서비스",
    links: [
      { label: "자주 묻는 질문", href: "#faq" },
      { label: "기능 소개", href: "#features" },
    ],
  },
  // {
  //   title: "시작하기",
  //   links: [
  //     { label: "로그인", href: ROUTES.LOGIN },
  //     { label: "회원가입", href: ROUTES.SIGNUP },
  //   ],
  // },
  {
    title: "법적 고지",
    links: [
      { label: "이용약관", href: "#" },
      { label: "개인정보처리방침", href: "#" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
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
          <p className="text-center text-xs text-muted-foreground">
            &copy; 2026 딱다구리. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
