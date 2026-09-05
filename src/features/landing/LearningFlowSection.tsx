import {
  BrainIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  NotebookPen,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";

import { learningFlowContent } from "./content";

const mockupByStep = {
  "01": <NoteMockup />,
  "02": <NotificationMockup />,
  "03": <TestMockup />,
} satisfies Record<
  (typeof learningFlowContent.scenes)[number]["step"],
  ReactNode
>;

/*
 * 아래 목업 셋은 루트에 `aria-hidden`을 건다. 실제 화면 마크업을 그대로 옮기느라
 * `nav`·`h3`·`ul`이 들어 있는데, 장식용 스크린샷이 랜드마크 목록과 제목 개요에
 * 섞이면 랜딩에 진짜 노트와 백지 테스트가 있는 것처럼 읽힌다. 안쪽 컨트롤이
 * 전부 span이라 포커스 가능한 요소가 없어 숨겨도 잃는 게 없다.
 */

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
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border bg-card shadow-lg"
    >
      <MockupChrome label="노트" />
      <div className="p-5">
        {/* 세로가 빠듯한 모바일에서는 경로를 숨긴다. 데스크톱에서는
            "노트 / 목록"처럼 라벨이 접히지 않게 nowrap으로 묶고, 줄어들 수
            있는 건 노트 제목뿐이므로 거기에만 truncate를 준다. 화살표는
            shrink-0으로 두어 눌리지 않게 한다. */}
        <nav className="hidden items-center gap-1 whitespace-nowrap text-xs text-muted-foreground md:flex">
          <span className="shrink-0">홈</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0">노트 목록</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate text-foreground">
            임진왜란의 3대 대첩
          </span>
        </nav>

        <div className="border-b border-border/60 pb-5 md:mt-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-foreground dark:bg-orange-950/40">
              복습 0회
            </span>
            <span className="min-w-0">다음 복습 일정: 내일 오전 09:00</span>
          </div>

          <h3 className="mt-4 text-2xl font-bold text-foreground">
            임진왜란의 3대 대첩
          </h3>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary pl-2 pr-2.5 text-sm font-medium text-primary-foreground">
              <NotebookPen className="size-4" aria-hidden />
              백지 테스트 시작
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background pl-2 pr-2.5 text-sm font-medium">
              <BrainIcon className="size-4" aria-hidden />
              퀴즈 풀기
            </span>
            <span className="ml-auto hidden size-8 items-center justify-center rounded-full text-muted-foreground md:inline-flex">
              <MoreHorizontalIcon className="size-4" aria-hidden />
            </span>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          한산도 대첩, 행주 대첩, 진주 대첩을 3대 대첩으로 꼽는다. 한산도 대첩은
          학익진으로 일본 수군을 크게 꺾어 남해의 제해권을 지켜냈다.
        </p>
      </div>
    </div>
  );
}

/**
 * 복습 알림이 닿는 두 경로의 정적 재현.
 *
 * 브라우저 푸시(`sw.ts`)와 앱 알림함(`NotificationBell` + `NotificationList`)은
 * 생김새가 비슷해 나란히 두면 같은 것이 두 번 나온 것처럼 읽힌다. 실제로는
 * 푸시가 먼저 오고 그 알림이 앱 알림함에 쌓이는 순서이므로, 위아래 순서를
 * 그 순서에 맞추고 캡션과 폭·정렬로 둘을 갈라 둔다.
 *
 * 둘을 위아래로 떼어 놓으면 목업만 세로로 길어져 부담스러우므로, 푸시를
 * 알림함 위에 겹쳐 띄운다. 실제로도 푸시는 앱 화면 위에 떠서 나타나므로
 * 겹치는 편이 동작에 더 가깝다. 겹치는 자리는 알림함 헤더의 오른쪽 빈
 * 영역이라 "새 알림" 배지 같은 내용은 가리지 않는다.
 *
 * 캡션은 실제 화면에 없는 목업 전용 라벨이다. 두 경로가 따로 있다는 걸
 * 처음 방문한 사람이 알 수 없어 붙였다.
 *
 * 목록 항목의 제목이 모두 같은 건 실제 동작이다 — 복습 알림은 notifications
 * 레코드의 title이 `REVIEW_NOTIFICATION_TITLE`로 고정되고 노트 제목은 body에
 * 들어가 설명 줄로 표시된다.
 *
 * 발송 시각은 실제로 `formatDateTime`이 연도까지 찍지만, 랜딩에 고정 날짜를
 * 박으면 그 부분만 시간이 지나 낡아 보여 연도를 뺀다.
 */
function NotificationMockup() {
  const items = [
    { note: "임진왜란의 3대 대첩", status: "새 알림", time: "오늘 오전 09:00" },
    {
      note: "세포막의 선택적 투과성",
      status: "읽음",
      time: "어제 오전 09:00",
    },
  ];

  return (
    <div aria-hidden="true" className="mx-auto max-w-96">
      {/* 브라우저가 띄우는 푸시. 앱 밖에서 뜨는 것이라 폭을 좁히고 오른쪽에
          붙여 아래 알림함과 한눈에 갈라지게 둔다. 좁은 화면에서 아래 "앱
          알림함" 캡션을 덮지 않도록 폭에 상한을 둔다. */}
      <div className="relative z-10 ml-auto w-64 max-w-[70%]">
        <p className="mb-2 text-xs text-muted-foreground">브라우저 알림</p>
        <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xl">
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

      {/* 앱 안 알림함. 실제 드롭다운과 같은 24rem 폭을 쓴다.
          음수 마진으로 위 푸시 아래에 파고들어 겹친다. */}
      <div className="-mt-12">
        <p className="mb-2 text-xs text-muted-foreground">앱 알림함</p>
        <div className="overflow-hidden rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">알림</p>
              <p className="text-xs text-muted-foreground">
                읽지 않은 알림 1개
              </p>
            </div>
          </div>

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
                  <p className="mt-2 text-[0.7rem] text-muted-foreground/80">
                    {item.time}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * 백지 테스트 화면(`BlankTestPage`의 제출 이후 상태)의 정적 재현.
 *
 * 실제 화면은 브레드크럼 → 헤더(회차 배지 + 노트 제목 + 안내 문구) →
 * `ComparisonView`(내 답안·원본 두 장) 순으로 쌓인다.
 *
 * 본문은 실제로 TipTap 뷰어가 렌더하지만 랜딩에 에디터 번들을 끌어올 이유가
 * 없어 문단만 옮긴다. 카드 안쪽 여백과 높이는 목업 폭에 맞춰 줄였다
 * (실제는 px-6 py-5에 min-h-[50vh]).
 */
function TestMockup() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border bg-card shadow-lg"
    >
      <MockupChrome label="백지 테스트" />
      <div className="space-y-4 p-4">
        {/* 랜딩에서 알려야 하는 건 "내 답안과 원본을 나란히 비교한다"는
            동작이고 경로는 거기에 보태는 게 없어, 세로가 빠듯한 모바일에서는
            숨긴다. 데스크톱은 4단계라 폭이 가장 빠듯하므로 라벨을 전부
            nowrap·shrink-0으로 묶고 남는 폭을 노트 제목이 truncate로
            흡수하게 한다. */}
        <nav className="hidden items-center gap-1 whitespace-nowrap text-xs text-muted-foreground md:flex">
          <span className="shrink-0">홈</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0">노트 목록</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">이온 결합과 공유 결합</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0 font-medium text-foreground">
            백지 테스트
          </span>
        </nav>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
              3차 복습
            </span>
            <span>백지 테스트</span>
          </div>
          <h3 className="text-xl font-bold text-foreground">
            이온 결합과 공유 결합
          </h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm">내 답안</CardTitle>
            </CardHeader>
            <CardContent className="min-h-28 px-4 py-3 text-sm leading-relaxed">
              금속이 전자를 잃고 비금속이 얻으면 이온 결합, 비금속끼리 전자쌍을
              나눠 가지면 공유 결합.
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm">원본</CardTitle>
            </CardHeader>
            <CardContent className="min-h-28 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              이온 결합은 양이온과 음이온 사이의 정전기적 인력으로 만들어지고,
              공유 결합은 두 원자가 전자쌍을 공유해 만들어진다.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function LearningFlowSection() {
  return (
    <section id="features">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <h2 className="mt-2 whitespace-pre-line text-center text-3xl font-bold tracking-tight md:text-4xl">
          {learningFlowContent.heading}
        </h2>

        <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-center text-muted-foreground md:mt-8">
          {learningFlowContent.introduction}
        </p>

        {/* 세 단계는 하나의 흐름이라 단계 사이 간격을 섹션 여백보다 좁게 둔다.
            멀어질수록 "아직도 기능 소개인가" 하는 인상이 커진다. */}
        <div className="mt-8 space-y-12 md:mt-16 md:space-y-20">
          {learningFlowContent.scenes.map((scene) => (
            <div
              key={scene.step}
              className={`flex flex-col gap-5 md:flex-row md:items-center md:gap-16 ${
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
                {/* scenes는 as const라 항목마다 타입이 다르다. subhead를 가진
                    단계만 좁혀서 렌더한다. */}
                {"subhead" in scene ? (
                  <p className="mt-4 text-sm font-medium text-orange-700 dark:text-orange-400">
                    {scene.subhead}
                  </p>
                ) : null}
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

      <div className="bg-orange-50 dark:bg-orange-950/40">
        <div className="mx-auto max-w-5xl px-6 py-10 text-center md:py-14">
          <p className="text-lg font-medium">{learningFlowContent.cta.text}</p>
          <Button size="xl" className="mt-4" asChild>
            <Link href={ROUTES.SIGNUP}>{learningFlowContent.cta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
