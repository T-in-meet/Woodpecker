import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-rose-950/20" />
      <div className="absolute -right-20 -top-20 -z-10 size-60 rounded-full bg-linear-to-br from-amber-200/40 to-orange-200/40 blur-3xl dark:from-amber-800/10 dark:to-orange-800/10" />
      <div className="absolute -bottom-20 -left-20 -z-10 size-60 rounded-full bg-linear-to-tr from-rose-200/40 to-pink-200/40 blur-3xl dark:from-rose-800/10 dark:to-pink-800/10" />

      <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          지금 바로 시작하세요
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          오늘 배운 것, 내일도 기억할 수 있습니다.
          <br />
          무료로 시작하고 학습 효과를 직접 경험하세요.
        </p>
        <div className="mt-8">
          <Button size="2xl" asChild>
            <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
