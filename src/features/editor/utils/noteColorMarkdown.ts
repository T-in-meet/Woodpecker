import {
  isNoteColorToken,
  NOTE_COLOR_TOKENS,
  type NoteColorTokenType,
} from "../noteColors";

// 표준 마크다운에는 색 문법이 없어 자체 문법을 쓴다.
//   글자색(인라인): {c=red}텍스트{/c}
//   배경색(블록):   {bg=yellow}로 시작하는 블록 전체
// 색 값은 NOTE_COLOR_TOKENS 화이트리스트만 허용하므로 임의 CSS가 들어올 수 없다.
export const NOTE_COLOR_ATTRIBUTE = "data-note-color";
export const NOTE_BLOCK_BACKGROUND_ATTRIBUTE = "data-note-block-bg";
// 줄 전체가 한 글자색일 때 목록 마커까지 물들이기 위한 표시. 저장되지 않는 파생 값이다.
export const NOTE_LINE_COLOR_ATTRIBUTE = "data-note-line-color";

export const NOTE_TEXT_COLOR_MARK_NAME = "noteTextColor";

const OPENING_BRACE_CHAR_CODE = 0x7b;

const TEXT_COLOR_TOKEN_PREFIX = "note_text_color";

const TOKEN_ALTERNATION = NOTE_COLOR_TOKENS.join("|");
const OPEN_MARKER_PATTERN = new RegExp(`^\\{c=(${TOKEN_ALTERNATION})\\}`);
const CLOSE_MARKER_PATTERN = /^\{\/c\}/;

// 블록 배경 마커는 블록 맨 앞에만 오며 닫는 짝이 없다.
export const NOTE_BLOCK_BACKGROUND_PATTERN = new RegExp(
  `^\\{bg=(${TOKEN_ALTERNATION})\\}`,
);

const ANY_MARKER_GLOBAL_PATTERN = new RegExp(
  `\\{(?:(?:c|bg)=(?:${TOKEN_ALTERNATION})|/c)\\}`,
  "g",
);

export function buildNoteTextColorOpenMarkup(
  token: NoteColorTokenType | null,
): string {
  return token ? `{c=${token}}` : "";
}

export function buildNoteTextColorCloseMarkup(
  token: NoteColorTokenType | null,
): string {
  return token ? "{/c}" : "";
}

export function buildNoteBlockBackgroundMarkup(
  token: NoteColorTokenType | null,
): string {
  return token ? `{bg=${token}}` : "";
}

// 평문으로 복사할 때 색 문법만 걷어내 다른 편집기에서 마커가 노출되지 않게 한다.
export function stripNoteColorSyntax(markdown: string): string {
  return markdown.replace(ANY_MARKER_GLOBAL_PATTERN, "");
}

type MarkdownItTokenType = {
  attrSet: (name: string, value: string) => void;
  attrGet: (name: string) => string | null;
};

type MarkdownItStateInlineType = {
  src: string;
  pos: number;
  posMax: number;
  push: (type: string, tag: string, nesting: number) => MarkdownItTokenType;
  // 열린 마커 수를 세어 짝이 없는 닫는 마커를 일반 텍스트로 남긴다.
  noteTextColorOpenDepth?: number;
};

type MarkdownItInlineRuleType = (
  state: MarkdownItStateInlineType,
  silent: boolean,
) => boolean;

type MarkdownItRendererRuleType = (
  tokens: MarkdownItTokenType[],
  index: number,
) => string;

export type NoteColorMarkdownItType = {
  inline: {
    ruler: {
      before: (
        beforeName: string,
        ruleName: string,
        rule: MarkdownItInlineRuleType,
      ) => void;
    };
  };
  renderer: {
    rules: Record<string, MarkdownItRendererRuleType | undefined>;
  };
};

const noteColorInlineRule: MarkdownItInlineRuleType = (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== OPENING_BRACE_CHAR_CODE) {
    return false;
  }

  const rest = state.src.slice(state.pos, state.posMax);
  // silent 모드는 다른 규칙이 앞을 훑어보는 단계라 깊이를 건드리지 않는다.
  state.noteTextColorOpenDepth ??= 0;

  const closeMatch = CLOSE_MARKER_PATTERN.exec(rest);
  if (closeMatch) {
    // 열린 적 없는 닫는 마커는 사용자가 입력한 리터럴로 보고 건드리지 않는다.
    if (state.noteTextColorOpenDepth === 0) return false;

    if (!silent) {
      state.noteTextColorOpenDepth -= 1;
      state.push(`${TEXT_COLOR_TOKEN_PREFIX}_close`, "span", -1);
    }

    state.pos += closeMatch[0].length;
    return true;
  }

  const openMatch = OPEN_MARKER_PATTERN.exec(rest);
  if (!openMatch) return false;

  const token = openMatch[1];

  if (!isNoteColorToken(token)) return false;
  // 짝이 되는 닫는 마커가 없으면 열지 않고 일반 텍스트로 흘려보낸다.
  if (!rest.includes("{/c}")) return false;

  if (!silent) {
    state.noteTextColorOpenDepth += 1;
    const openToken = state.push(`${TEXT_COLOR_TOKEN_PREFIX}_open`, "span", 1);
    openToken.attrSet(NOTE_COLOR_ATTRIBUTE, token);
  }

  state.pos += openMatch[0].length;
  return true;
};

// tiptap-markdown이 parse마다 setup을 호출하므로 같은 인스턴스에 중복 등록되지 않게 막는다.
const configuredMarkdownItInstances = new WeakSet<NoteColorMarkdownItType>();

export function setupNoteColorMarkdownIt(md: NoteColorMarkdownItType): void {
  if (configuredMarkdownItInstances.has(md)) return;
  configuredMarkdownItInstances.add(md);

  md.inline.ruler.before("text", "noteColor", noteColorInlineRule);

  md.renderer.rules[`${TEXT_COLOR_TOKEN_PREFIX}_open`] = (tokens, index) => {
    const value = tokens[index]?.attrGet(NOTE_COLOR_ATTRIBUTE);

    // 렌더 직전에도 화이트리스트를 다시 확인한다.
    if (!isNoteColorToken(value)) return "<span>";

    return `<span ${NOTE_COLOR_ATTRIBUTE}="${value}">`;
  };

  md.renderer.rules[`${TEXT_COLOR_TOKEN_PREFIX}_close`] = () => "</span>";
}
