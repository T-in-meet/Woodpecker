"use client";

import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Table,
  TextQuote,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { createRoot } from "react-dom/client";

import { cn } from "@/lib/utils/cn";

import type { SlashCommandItem } from "../utils/slashCommand";

const ICON_MAP: Record<string, React.ReactNode> = {
  "heading-1": <Heading1 className="size-4" />,
  "heading-2": <Heading2 className="size-4" />,
  "heading-3": <Heading3 className="size-4" />,
  list: <List className="size-4" />,
  "list-ordered": <ListOrdered className="size-4" />,
  "list-checks": <ListChecks className="size-4" />,
  "text-quote": <TextQuote className="size-4" />,
  code: <Code className="size-4" />,
  minus: <Minus className="size-4" />,
  table: <Table className="size-4" />,
};

export type SlashCommandMenuRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

type SlashCommandMenuProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (items.length === 0) {
        return false;
      }

      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) {
          command(item);
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="slash-command-menu rounded-lg border border-border bg-popover p-2 text-sm text-muted-foreground shadow-md">
        결과 없음
      </div>
    );
  }

  return (
    <div className="slash-command-menu max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            index === selectedIndex
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50",
          )}
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            {ICON_MAP[item.icon]}
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";

export function slashCommandSuggestionRender() {
  return {
    render: () => {
      let component: SlashCommandMenuRef | null = null;
      let reactRoot: HTMLElement | null = null;
      let reactDomRoot: ReturnType<typeof createRoot> | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          destroy();

          reactRoot = document.createElement("div");
          reactRoot.classList.add("slash-command-container");
          document.body.appendChild(reactRoot);

          reactDomRoot = createRoot(reactRoot);
          reactDomRoot.render(
            <SlashCommandMenu
              ref={(menu) => {
                component = menu;
              }}
              items={props.items as SlashCommandItem[]}
              command={props.command as (item: SlashCommandItem) => void}
            />,
          );

          updatePosition(reactRoot, props.clientRect);
        },

        onUpdate: (props: SuggestionProps) => {
          if (reactDomRoot && reactRoot) {
            reactDomRoot.render(
              <SlashCommandMenu
                ref={(menu) => {
                  component = menu;
                }}
                items={props.items as SlashCommandItem[]}
                command={props.command as (item: SlashCommandItem) => void}
              />,
            );
            updatePosition(reactRoot, props.clientRect);
          }
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            destroy();
            return true;
          }
          return component?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          destroy();
        },
      };

      function destroy() {
        reactDomRoot?.unmount();
        reactRoot?.remove();
        reactRoot = null;
        reactDomRoot = null;
        component = null;
      }

      function updatePosition(
        element: HTMLElement,
        clientRect: (() => DOMRect | null) | null | undefined,
      ) {
        const rect = clientRect?.();
        if (!rect) return;

        element.style.position = "fixed";
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.bottom + 4}px`;
        element.style.zIndex = "50";
      }
    },
  };
}
