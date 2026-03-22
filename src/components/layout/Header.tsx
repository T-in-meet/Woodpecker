import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href={ROUTES.HOME} className="flex items-center gap-2">
          {/* 추후 로고 이미지 변화 가능 */}
          <Image src="/favicon.svg" alt="딱다구리" width={28} height={28} />
          <span className="font-jeju text-2xl">딱다구리</span>
        </Link>

        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href={ROUTES.LOGIN}>로그인</Link>
          </Button>
          <Button asChild>
            <Link href={ROUTES.SIGNUP}>회원가입</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
