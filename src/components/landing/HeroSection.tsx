import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-28 text-center md:py-40">
      {/* Beta badge */}
      <div className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
        현재 베타 서비스 운영 중
      </div>

      <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
        공부해도 잊혀진다면
        <br />
        <span className="text-primary">1-3-7 복습</span>으로
        <br />
        기억을 완성하세요
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
        딱다구리는 학습 내용을 기록하고,
        <br className="hidden md:block" />
        1일 · 3일 · 7일 뒤 백지 테스트로 기억을 굳혀주는 서비스입니다.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" asChild>
          <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href="#features">어떻게 작동하나요?</a>
        </Button>
      </div>

      {/* Note card decorative element */}
      <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-5 text-left shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary/40" />
          <span className="text-xs font-medium text-muted-foreground">
            오늘의 기록 · JavaScript 클로저
          </span>
        </div>
        <p className="text-sm font-medium">클로저(Closure)란?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          함수가 자신이 생성될 때의 스코프를 기억하여, 스코프 밖에서
          호출되더라도 해당 스코프에 접근할 수 있는 것.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            1일 후 복습 예정
          </span>
        </div>
      </div>
    </section>
  );
}
