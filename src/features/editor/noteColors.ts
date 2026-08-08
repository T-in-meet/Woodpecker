// 노트 본문에서 쓸 수 있는 색은 이 토큰 목록으로 고정한다.
// 사용자가 임의의 CSS 값을 넣을 수 없게 하기 위한 화이트리스트이며,
// 실제 색상값은 tiptap.css의 CSS 변수에서 정의한다.
export const NOTE_COLOR_TOKENS = [
  "gray",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "red",
] as const;

export type NoteColorTokenType = (typeof NOTE_COLOR_TOKENS)[number];

export const NOTE_COLOR_LABELS: Record<NoteColorTokenType, string> = {
  gray: "회색",
  orange: "주황",
  yellow: "노랑",
  green: "초록",
  blue: "파랑",
  purple: "보라",
  red: "빨강",
};

// 색을 지정하지 않은 상태(노션의 "기본")를 가리킨다.
export const NOTE_COLOR_DEFAULT_LABEL = "기본";

export function isNoteColorToken(value: unknown): value is NoteColorTokenType {
  return (
    typeof value === "string" &&
    (NOTE_COLOR_TOKENS as readonly string[]).includes(value)
  );
}

export function normalizeNoteColorToken(
  value: unknown,
): NoteColorTokenType | null {
  return isNoteColorToken(value) ? value : null;
}
