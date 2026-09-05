import { BrainIcon, NotebookPen } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { learningFlowContent } from "./content";

const mockupByStep = {
  "01": <NoteMockup />,
  "02": <NotificationMockup />,
  "03": <TestMockup />,
} satisfies Record<
  (typeof learningFlowContent.scenes)[number]["step"],
  ReactNode
>;

/** 목업 공통 브라우저 크롬. 캡처가 아니라 DOM이라 어떤 해상도에서도 선명하다. */
function MockupChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
      <div className="size-2.5 rounded-full bg-red-400/60" />
      <div className="size-2.5 rounded-full bg-yellow-400/60" />
      <div className="size-2.5 rounded-full bg-green-400/60" />
      <span className="ml-2 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * 노트 상세 화면(`NoteDetailBody`)의 헤더를 축소해 옮긴 정적 목업.
 * 배지 줄·제목·액션 버튼의 순서와 클래스를 실제 화면과 맞춘다.
 * 버튼은 실제 컨트롤이 아니므로 span으로 둔다.
 */
function NoteMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
      <MockupChrome label="노트" />
      <div className="p-5">
        <div className="border-b border-border/60 pb-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-foreground">
              복습 0회
            </span>
            <span className="min-w-0">첫 복습은 내일 예정이에요</span>
          </div>

          <h3 className="mt-4 text-xl font-bold text-foreground">
            임진왜란의 3대 대첩
          </h3>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              <NotebookPen className="size-4" aria-hidden />
              백지 테스트 시작
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border px-4 text-sm font-medium">
              <BrainIcon className="size-4" aria-hidden />
              퀴즈 풀기
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          한산도 대첩, 행주 대첩, 진주 대첩을 3대 대첩으로 꼽는다. 한산도 대첩은
          학익진으로 일본 수군을 크게 꺾어 남해의 제해권을 지켜냈다.
        </p>
      </div>
    </div>
  );
}

/**
 * 알림 목록(`NotificationList`)과 Web Push 알림의 정적 재현.
 *
 * 목록 항목의 제목이 모두 같은 건 실제 동작이다 — 복습 알림은 제목이
 * `REVIEW_NOTIFICATION_TITLE`로 고정되고 노트 제목은 설명 줄에 들어간다.
 * 실제 목록에 있는 발송 시각 줄은 뺐다. 고정 날짜를 박아두면 시간이 지나
 * 랜딩만 낡아 보이기 때문이다.
 */
function NotificationMockup() {
  const items = [
    { note: "임진왜란의 3대 대첩", status: "새 알림" },
    { note: "세포막의 선택적 투과성", status: "읽음" },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        <MockupChrome label="딱다구리" />
        <ul aria-label="알림 목록">
          {items.map((item) => (
            <li
              key={item.note}
              className="flex items-start gap-2 border-t border-border/60 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    복습할 시간이에요!
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {item.note}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 아이콘은 sw.ts의 `icon: "/favicon.svg"`, 문구는 dispatch-notifications의 payload */}
      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-md">
        <Image
          src="/favicon.svg"
          alt=""
          width={20}
          height={20}
          className="mt-0.5"
        />
        <div>
          <p className="text-xs text-muted-foreground">딱다구리 · 지금</p>
          <p className="mt-0.5 text-sm font-semibold">복습할 시간이에요!</p>
          <p className="text-xs text-muted-foreground">
            &quot;임진왜란의 3대 대첩&quot; 복습할 시간이에요.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 백지 테스트 결과 화면(`ComparisonView`)의 정적 재현.
 * 실제 화면은 Card 두 장을 나란히 두고 제목이 "내 답안"·"원본"이다.
 * 본문은 TipTap 뷰어로 렌더되지만, 랜딩에 에디터 번들을 끌어올 이유가 없어
 * 문단만 옮긴다.
 */
function TestMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
      <MockupChrome label="백지 테스트" />
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-sm">내 답안</CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm leading-relaxed">
            금속이 전자를 잃고 비금속이 얻으면 이온 결합, 비금속끼리 전자쌍을
            나눠 가지면 공유 결합.
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-sm">원본</CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm leading-relaxed text-muted-foreground">
            이온 결합은 양이온과 음이온 사이의 정전기적 인력으로 만들어지고,
            공유 결합은 두 원자가 전자쌍을 공유해 만들어진다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function LearningFlowSection() {
  return (
    <section id="features">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h2 className="mt-2 whitespace-pre-line text-center text-3xl font-bold tracking-tight md:text-4xl">
          {learningFlowContent.heading}
        </h2>

        <p className="mx-auto mt-8 max-w-xl whitespace-pre-line text-center text-muted-foreground">
          {learningFlowContent.introduction}
        </p>

        <div className="mt-20 space-y-24">
          {learningFlowContent.scenes.map((scene) => (
            <div
              key={scene.step}
              className={`flex flex-col gap-10 md:flex-row md:items-center md:gap-16 ${
                scene.reverse ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Text */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-orange-200 dark:text-orange-900">
                    {scene.step}
                  </span>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                    {scene.eyebrow}
                  </span>
                </div>
                <h3 className="mt-4 whitespace-pre-line text-2xl font-bold tracking-tight md:text-3xl">
                  {scene.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground md:text-base">
                  {scene.description}
                </p>
              </div>

              {/* Mockup */}
              <div className="flex-1">{mockupByStep[scene.step]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
