"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function AuthButtons() {
  const pathname = usePathname();

  if (pathname === ROUTES.LOGIN || pathname === ROUTES.SIGNUP) return null;

  return (
    <>
      <Button variant="ghost" asChild>
        <Link href={ROUTES.LOGIN}>로그인</Link>
      </Button>

      <Button asChild>
        <Link href={ROUTES.SIGNUP}>회원가입</Link>
      </Button>
    </>
  );
}
