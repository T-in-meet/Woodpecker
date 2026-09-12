"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

import type { GuideHeading } from "../lib/prepareGuideMarkdown";

/* `--header-height`를 못 읽는 환경(테스트 등)에서 쓰는 값. globals.css와 같다. */
const FALLBACK_HEADER_HEIGHT = 70;

/* 제목이 헤더 아래 이만큼 들어오면 그 절을 읽는 중으로 본다. `Heading2`의
   scroll-mt-24(96px)보다 조금 커야 앵커로 이동한 직후에도 그 절이 강조된다. */
const ACTIVE_OFFSET = 32;

function readHeaderHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--header-height",
  );
  const parsed = Number.parseInt(raw, 10);

  return Number.isNaN(parsed) ? FALLBACK_HEADER_HEIGHT : parsed;
}

/**
 * 스크롤 위치로 현재 읽는 절을 고른다. 헤더 아래 기준선을 지난 마지막 제목이다.
 *
 * IntersectionObserver로 "보이는 제목"을 세면 한 절이 화면보다 길 때 제목이
 * 화면 밖으로 나가 아무것도 잡히지 않는다. 기준선을 지난 마지막 제목을 고르면
 * 긴 절 한가운데서도, 위로 되돌아갈 때도 읽는 절과 강조가 어긋나지 않는다.
 */
function useActiveHeading(headings: readonly GuideHeading[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const threshold = readHeaderHeight() + ACTIVE_OFFSET;
    let frame = 0;

    const update = () => {
      frame = 0;

      let current = elements[0]?.id ?? null;

      for (const element of elements) {
        if (element.getBoundingClientRect().top <= threshold) {
          current = element.id;
        }
      }

      setActiveId(current);
    };

    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [headings]);

  return activeId;
}

/**
 * 문서의 H2 목록. `prepareGuideMarkdown`이 모든 H2에 id를 달아 두므로 앵커로 이동한다.
 *
 * `<details>` 하나로 두 화면을 다 처리한다. 좁은 화면에서는 본문 위의 접이식
 * 상자, 넓은 화면에서는 왼쪽 열에 붙어 따라오는 차례다. 같은 목록을 두 번
 * 그리면 스크린리더에 차례가 두 번 읽히므로 마크업은 하나만 둔다.
 *
 * 가이드 화면에서 유일한 클라이언트 컴포넌트다. 현재 절 강조에만 스크롤이
 * 필요하고, 그 상태는 이 컴포넌트 밖으로 나가지 않는다.
 */
export function GuideToc({ headings }: { headings: readonly GuideHeading[] }) {
  const activeId = useActiveHeading(headings);

  if (headings.length === 0) {
    return null;
  }

  return (
    <details
      open
      className="group rounded-lg border bg-white/70 px-4 py-3 text-sm text-prose-ko lg:rounded-none lg:border-0 lg:border-l lg:border-brand-border lg:bg-transparent lg:py-0 lg:pl-4 lg:pr-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
          이 글의 차례
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {headings.length}개 절
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <nav aria-label="이 글의 차례">
        <ol className="mt-2 space-y-0.5 text-muted-foreground">
          {headings.map((heading) => {
            const active = heading.id === activeId;

            return (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "block cursor-pointer py-1 leading-snug transition-colors hover:text-brand",
                    /* 넓은 화면에서는 aside의 왼쪽 선 위에 강조선을 겹친다. */
                    "lg:-ml-[calc(1rem+1px)] lg:border-l-2 lg:border-transparent lg:pl-[calc(1rem-1px)]",
                    active && "font-semibold text-brand lg:border-brand",
                  )}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </details>
  );
}
