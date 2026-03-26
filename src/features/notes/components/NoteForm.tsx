"use client";

export function NoteForm() {
  return (
    <form>
      <input name="title" placeholder="제목" />
      <textarea name="content" placeholder="내용" />
      <button type="submit">저장</button>
    </form>
  );
}
