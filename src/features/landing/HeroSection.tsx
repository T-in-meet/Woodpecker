import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-rose-950/20" />
      <div className="absolute -right-40 -top-40 -z-10 size-96 rounded-full bg-linear-to-br from-amber-200/40 to-orange-200/40 blur-3xl dark:from-amber-800/10 dark:to-orange-800/10" />
      <div className="absolute -bottom-20 -left-40 -z-10 size-80 rounded-full bg-linear-to-tr from-rose-200/40 to-pink-200/40 blur-3xl dark:from-rose-800/10 dark:to-pink-800/10" />

      <div className="mx-auto max-w-5xl px-6 py-28 md:py-40">
        <h1 className="text-5xl font-bold tracking-tight text-center">
          기록이 기억이 되는 공간
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-center text-lg text-muted-foreground md:text-xl">
          기록한 순간부터 복습이 설계됩니다.
          <br />
          노트 기록부터 복습 알림, 백지 테스트까지 한 곳에서.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="2xl" asChild>
            <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
          </Button>
        </div>

        {/* TODO: 앱 목업 교체 필요
            - 현재: 정적 목업 (임시)
            - 교체 조건: 기록/알림/복습 화면 디자인 확정 후
            - 교체 방향: gif 또는 mp4 autoplay로 서비스 흐름 시연 */}
        {/* App mockup preview */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="relative pb-10 pr-10">
            {/* Main mockup */}
            <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
              {/* Chrome */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
                <div className="size-2.5 rounded-full bg-red-400/60" />
                <div className="size-2.5 rounded-full bg-yellow-400/60" />
                <div className="size-2.5 rounded-full bg-green-400/60" />
                <span className="ml-2 text-xs text-muted-foreground">
                  딱다구리
                </span>
              </div>

              {/* Body */}
              <div className="p-6 text-left">
                {/* Record label */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-orange-500" />
                  <span className="text-xs text-muted-foreground">
                    오늘의 기록 · JavaScript 클로저
                  </span>
                </div>

                {/* Record 1 */}
                <p className="text-base font-semibold">클로저(Closure)란?</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  함수가 자신이 생성될 때의 스코프를 기억하여, 스코프 밖에서
                  호출되더라도 해당 스코프에 접근할 수 있는 것.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  🕐 1일 후 복습 예정
                </span>

                <hr className="my-4 border-border" />

                {/* Record 2 */}
                <p className="text-sm font-semibold">
                  React useEffect 생명주기
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  컴포넌트가 렌더링된 후 실행되며, 의존성 배열에 따라 실행
                  시점이 달라진다.
                </p>
                <span className="mt-2.5 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  3일 후 복습 예정
                </span>
              </div>
            </div>

            {/* Floating 알림 카드 */}
            <div className="absolute bottom-0 right-0 w-56 rounded-xl border bg-card p-4 shadow-xl">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-base">🔔</span>
                <span className="text-xs text-muted-foreground">
                  딱다구리 · 지금
                </span>
              </div>
              <p className="text-sm font-semibold">복습할 시간이에요!</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                JavaScript 클로저 — 기억나시나요?
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
