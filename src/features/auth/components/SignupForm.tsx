"use client";

export function SignupForm() {
  return (
    <form>
      <input name="email" type="email" placeholder="이메일" />
      <input name="password" type="password" placeholder="비밀번호" />
      <input
        name="confirmPassword"
        type="password"
        placeholder="비밀번호 확인"
      />
      <button type="submit">회원가입</button>
    </form>
  );
}
