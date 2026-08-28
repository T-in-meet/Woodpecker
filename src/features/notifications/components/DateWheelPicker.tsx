"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";

import { cn } from "@/lib/utils/cn";

const ITEM_HEIGHT_PX = 40;
/** 스크롤이 멎었다고 볼 때까지 기다리는 시간. 스냅이 끝난 뒤의 위치만 선택으로 친다. */
const SCROLL_SETTLE_MS = 100;

type DateWheelOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DateWheelPickerProps = {
  value: string;
  options: DateWheelOption[];
  disabled: boolean;
  onValueChange: (value: string) => void;
};

function scrollToIndex(
  element: HTMLDivElement,
  index: number,
  behavior: ScrollBehavior,
) {
  const top = index * ITEM_HEIGHT_PX;

  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top, behavior });
    return;
  }

  element.scrollTop = top;
}

export function DateWheelPicker({
  value,
  options,
  disabled,
  onValueChange,
}: DateWheelPickerProps) {
  const listboxId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isWheelUpdateRef = useRef(false);
  // 코드가 굴린 스크롤이 만드는 중간 위치를 사용자의 선택으로 오인하지 않기 위한 표시.
  const isProgrammaticScrollRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  const scrollToOption = useCallback(
    (index: number, behavior: ScrollBehavior) => {
      const element = scrollRef.current;

      if (!element || element.scrollTop === index * ITEM_HEIGHT_PX) {
        return;
      }

      isProgrammaticScrollRef.current = true;
      scrollToIndex(element, index, behavior);
    },
    [],
  );

  useEffect(() => {
    if (isWheelUpdateRef.current) {
      isWheelUpdateRef.current = false;
      return;
    }

    scrollToOption(selectedIndex, "smooth");
  }, [selectedIndex, scrollToOption]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  const selectIndex = (index: number, behavior: ScrollBehavior) => {
    const option = options[index];

    if (!option || option.disabled) {
      return;
    }

    scrollToOption(index, behavior);

    if (option.value !== value) {
      isWheelUpdateRef.current = true;
      onValueChange(option.value);
    }
  };

  const handleScrollSettled = () => {
    settleTimerRef.current = null;

    // 코드가 굴린 스크롤이 끝난 것뿐이면 값은 이미 반영돼 있다.
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const nextIndex = Math.min(
      Math.max(Math.round(element.scrollTop / ITEM_HEIGHT_PX), 0),
      options.length - 1,
    );
    const nextOption = options[nextIndex];

    // 고를 수 없는 날짜에 멈추면 화면에 선택된 것처럼 보이는 날짜와 실제 값이
    // 갈리므로, 현재 선택으로 되돌려 둘을 다시 맞춘다.
    if (!nextOption || nextOption.disabled) {
      scrollToOption(selectedIndex, "smooth");
      return;
    }

    if (nextOption.value === value) {
      return;
    }

    isWheelUpdateRef.current = true;
    onValueChange(nextOption.value);
  };

  // 스크롤 이벤트마다 값을 바꾸면 smooth 스크롤이 지나치는 중간 날짜들이 그대로
  // 커밋된다. 스크롤이 멎은 뒤의 위치 한 번만 선택으로 본다.
  const handleScroll = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(
      handleScrollSettled,
      SCROLL_SETTLE_MS,
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowUp") {
      nextIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === "ArrowDown") {
      nextIndex = Math.min(selectedIndex + 1, options.length - 1);
    } else if (event.key === "Home") {
      nextIndex = options.findIndex((option) => !option.disabled);
    } else if (event.key === "End") {
      nextIndex = options.findLastIndex((option) => !option.disabled);
    }

    if (nextIndex === null || nextIndex < 0) {
      return;
    }

    event.preventDefault();
    selectIndex(nextIndex, "smooth");
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-input bg-background">
      <div
        ref={scrollRef}
        role="listbox"
        aria-label="날짜"
        aria-activedescendant={`${listboxId}-${selectedIndex}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="h-30 snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-2 py-10 outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled || option.disabled}
              tabIndex={-1}
              onClick={() => selectIndex(index, "smooth")}
              className={cn(
                "flex h-10 w-full snap-center cursor-pointer items-center justify-center rounded-md px-3 text-sm transition-[color,background-color,opacity] disabled:cursor-not-allowed",
                isSelected
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground opacity-55 hover:bg-muted/50 hover:opacity-100",
                option.disabled && "opacity-30",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-background to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent"
      />
    </div>
  );
}
