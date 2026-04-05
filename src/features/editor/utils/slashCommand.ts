import { type Editor, Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export type SlashCommandItem = {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
};

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: "제목 1",
    description: "큰 제목",
    icon: "heading-1",
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "제목 2",
    description: "중간 제목",
    icon: "heading-2",
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "제목 3",
    description: "작은 제목",
    icon: "heading-3",
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "글머리 기호 목록",
    description: "순서 없는 목록",
    icon: "list",
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "번호 목록",
    description: "순서 있는 목록",
    icon: "list-ordered",
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "체크리스트",
    description: "할 일 목록",
    icon: "list-checks",
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "인용문",
    description: "인용 블록",
    icon: "text-quote",
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "코드 블록",
    description: "코드 작성 영역",
    icon: "code",
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "구분선",
    description: "수평 구분선",
    icon: "minus",
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "표",
    description: "3×3 표 삽입",
    icon: "table",
    command: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
];

const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: slashCommandPluginKey,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashCommandItem;
        }) => {
          editor.chain().focus().deleteRange(range).run();
          props.command(editor);
        },
        items: ({ query }: { query: string }): SlashCommandItem[] => {
          return SLASH_COMMAND_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase()),
          );
        },
      } satisfies Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
