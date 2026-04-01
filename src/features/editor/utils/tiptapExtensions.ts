import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import { createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";

import { slashCommandSuggestionRender } from "../components/SlashCommandMenu";
import { SlashCommand } from "./slashCommand";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("rust", rust);
lowlight.register("go", go);

function isPureTaskListElement(list: Element): boolean {
  const items = Array.from(list.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName === "LI",
  );

  return (
    items.length > 0 &&
    items.every((item) => item.classList.contains("task-list-item"))
  );
}

const MarkdownTaskItem = TaskItem.extend({
  addStorage() {
    return {
      markdown: {
        parse: {
          updateDOM(element: HTMLElement) {
            for (const item of element.querySelectorAll(".task-list-item")) {
              if (!(item instanceof HTMLElement)) continue;

              const parentList = item.closest("ul");
              const input = item.querySelector("input");

              if (!parentList || !isPureTaskListElement(parentList)) {
                parentList?.removeAttribute("data-type");
                item.removeAttribute("data-type");
                item.removeAttribute("data-checked");
                item.classList.remove("task-list-item");

                if (input instanceof HTMLInputElement) {
                  const marker = input.checked ? "[x] " : "[ ] ";
                  input.replaceWith(item.ownerDocument.createTextNode(marker));
                }

                continue;
              }

              item.setAttribute("data-type", "taskItem");

              if (input instanceof HTMLInputElement) {
                item.setAttribute("data-checked", String(input.checked));
                input.remove();
              }
            }
          },
        },
      },
    };
  },
});

function getBaseExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: "tiptap-link" },
    }),
    TaskList,
    MarkdownTaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({
      html: false,
      breaks: true,
      tightLists: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}

export function getTipTapExtensions({
  placeholder,
}: { placeholder?: string | undefined } = {}) {
  return [
    ...getBaseExtensions(),
    SlashCommand.configure({
      suggestion: { ...slashCommandSuggestionRender() },
    }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

export function getReadOnlyTipTapExtensions() {
  return getBaseExtensions();
}
