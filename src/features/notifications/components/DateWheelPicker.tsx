"use client";

import {
  type KeyboardEvent,
  type UIEvent,
  useEffect,
  useId,
  useRef,
} from "react";

import { cn } from "@/lib/utils/cn";

const ITEM_HEIGHT_PX = 40;

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
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  useEffect(() => {
    if (isWheelUpdateRef.current) {
      isWheelUpdateRef.current = false;
      return;
    }

    if (scrollRef.current) {
      scrollToIndex(scrollRef.current, selectedIndex, "smooth");
    }
  }, [selectedIndex]);

  const selectIndex = (index: number, behavior: ScrollBehavior) => {
    const option = options[index];

    if (!option || option.disabled) {
      return;
    }

    if (scrollRef.current) {
      scrollToIndex(scrollRef.current, index, behavior);
    }

    if (option.value !== value) {
      isWheelUpdateRef.current = true;
      onValueChange(option.value);
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const nextIndex = Math.min(
      Math.max(Math.round(event.currentTarget.scrollTop / ITEM_HEIGHT_PX), 0),
      options.length - 1,
    );
    const nextOption = options[nextIndex];

    if (!nextOption || nextOption.disabled || nextOption.value === value) {
      return;
    }

    isWheelUpdateRef.current = true;
    onValueChange(nextOption.value);
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
