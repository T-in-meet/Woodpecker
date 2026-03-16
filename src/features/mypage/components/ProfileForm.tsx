"use client";

export function ProfileForm() {
  return (
    <form>
      <input name="username" placeholder="사용자명" />
      <textarea name="bio" placeholder="소개" />
      <button type="submit">저장</button>
    </form>
  );
}
