import {
  CalendarClock,
  ChevronDown,
  ListFilter,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";

import { heroContent } from "./content";

/**
 * 목업에 표시할 노트. 실제 목록 화면의 `NoteSummary`를 그대로 쓰지 않고
 * 화면에 보이는 값만 추린다 — 쿼리 타입이 바뀔 때 랜딩이 끌려다니지 않게 한다.
 */
const previewNotes = [
  {
    title: "세포 호흡의 3단계",
    preview:
      "해당과정, TCA 회로, 전자전달계를 거쳐 포도당 한 분자를 분해하고 ATP를 얻는다.",
    reviewRound: 3,
    scheduleText: "오늘",
    // NoteListItem의 tone별 클래스와 같은 값을 쓴다(today / upcoming).
    scheduleClass: "bg-emerald-100 text-emerald-800",
  },
  {
    title: "가정법 과거완료",
    preview:
      "If + 주어 + had p.p., 주어 + would have p.p. 형태로 과거 사실의 반대를 가정한다.",
    reviewRound: 1,
    scheduleText: "3일 후",
    scheduleClass: "bg-blue-100 text-blue-800",
  },
];

/**
 * 노트 목록 화면(`features/notes`)의 정적 재현.
 *
 * 실제 컴포넌트를 import하지 않는 이유: `NoteListItem`은 `NoteActions`를 통해
 * 삭제 다이얼로그와 복습 시작 훅을 끌고 오고, 카드 전체가 `/notes/<id>`로 가는
 * 링크다. 로그인 없이 열리는 랜딩에는 맞지 않으므로 마크업만 옮긴다.
 * 대신 클릭 가능한 요소는 전부 span으로 두어 실제 컨트롤처럼 보이지 않게 한다.
 *
 * 목록 화면 UI를 바꾸면 이 목업도 함께 손봐야 한다.
 */
function NotesPreview() {
  return (
    <div className="bg-muted/20 p-4 text-left sm:p-5">
      {/* 툴바 — NotesToolbar의 보기 필터와 검색 입력 */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-32 shrink-0 items-center justify-between rounded-md border bg-background px-3 text-sm">
          <span className="flex items-center gap-1.5">
            <ListFilter className="size-4 text-muted-foreground" aria-hidden />
            전체
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" aria-hidden />
          노트 검색
        </div>
      </div>

      {/* 노트 목록 */}
      <div className="mt-4 space-y-3">
        {previewNotes.map((note) => (
          <Card key={note.title} className="relative">
            <CardContent className="p-4 sm:p-5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-base font-semibold leading-snug">
                  {note.title}
                </span>
                <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                  복습 {note.reviewRound}회
                </span>
              </div>

              <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                {note.preview}
              </p>

              <div className="my-3.5 border-t" />

              {/* 오른쪽 pr은 아래 절대 배치된 액션 버튼이 차지하는 폭을 비워
                  두는 값이다. 버튼 크기를 바꾸면 이 값도 같이 맞춰야 한다.
                  좁은 화면에서는 버튼을 줄여 "복습일 + 배지"가 한 줄에
                  들어가게 한다. */}
              <div className="flex min-h-8 items-center gap-4 pr-28 text-sm text-muted-foreground sm:pr-32">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>복습일</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${note.scheduleClass}`}
                  >
                    {note.scheduleText}
                  </span>
                </div>
              </div>
            </CardContent>

            {/* NoteActions의 정적 재현 — 실제 버튼이 아니므로 span으로 둔다 */}
            <div className="absolute bottom-4 right-4 flex shrink-0 items-center gap-0.5 sm:bottom-5 sm:right-5 sm:gap-1">
              <span className="inline-flex h-7 items-center gap-0.5 rounded-md border border-emerald-600/40 px-2 text-[0.7rem] font-medium text-emerald-700 sm:h-8 sm:gap-1 sm:px-2.5 sm:text-xs">
                <Play className="h-3.5 w-3.5" aria-hidden />
                복습 시작
              </span>
              <span className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground sm:size-8">
                <Trash2 className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-rose-950/20" />
      <div className="absolute -right-40 -top-40 -z-10 size-96 rounded-full bg-linear-to-br from-amber-200/40 to-orange-200/40 blur-3xl dark:from-amber-800/10 dark:to-orange-800/10" />
      <div className="absolute -bottom-20 -left-40 -z-10 size-80 rounded-full bg-linear-to-tr from-rose-200/40 to-pink-200/40 blur-3xl dark:from-rose-800/10 dark:to-pink-800/10" />

      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h1 className="text-center text-5xl font-bold tracking-tight">
          {heroContent.title}
        </h1>

        <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-center text-lg text-muted-foreground md:text-xl">
          {heroContent.description}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="2xl" asChild>
            <Link href={ROUTES.SIGNUP}>{heroContent.ctaLabel}</Link>
          </Button>
        </div>

        {/* App mockup preview */}
        <div className="mx-auto mt-16 max-w-3xl">
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

            <NotesPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
