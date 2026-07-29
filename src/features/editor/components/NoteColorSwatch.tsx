"use client";

import type { NoteColorSwatchType } from "../utils/blockActionGroups";

type NoteColorSwatchProps = {
  swatch: NoteColorSwatchType;
};

export function NoteColorSwatch({ swatch }: NoteColorSwatchProps) {
  const { kind, token } = swatch;

  // "기본"은 색이 없는 상태라 테두리만 있는 빈 견본으로 보여준다.
  const style =
    token === null
      ? undefined
      : kind === "color"
        ? { color: `var(--note-text-${token})` }
        : { backgroundColor: `var(--note-bg-${token})` };

  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-border text-[0.625rem] font-semibold"
      style={style}
    >
      가
    </span>
  );
}
