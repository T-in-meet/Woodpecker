import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function CtaSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          지금 바로 시작하세요
        </h2>
        <p className="mt-3 text-muted-foreground">
          오늘 배운 것, 내일도 기억할 수 있습니다. 무료로 시작하세요.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
