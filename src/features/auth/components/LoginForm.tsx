"use client";

export function LoginForm() {
  return (
    <form>
      <input name="email" type="email" placeholder="이메일" />
      <input name="password" type="password" placeholder="비밀번호" />
      <button type="submit">로그인</button>
    </form>
  );
}
