"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  return (
    <form
      aria-label="회원가입"
      className="max-w-5xl mx-auto mt-20 pl-4 space-y-4"
    >
      <div className="space-y-4">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" />
      </div>

      <div className="space-y-4">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" />
      </div>

      <div className="space-y-4">
        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" />
      </div>

      <div className="space-y-4">
        <Label htmlFor="nickname">닉네임</Label>
        <Input id="nickname" name="nickname" type="text" />
      </div>

      <div className="space-y-4">
        <Label htmlFor="avatarFile">
          프로필 사진 <span>(선택)</span>
        </Label>
        <Input
          id="avatarFile"
          name="avatarFile"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </div>

      <div className="flex justify-between">
        <div className="space-y-4 flex-1 ">
          <input type="checkbox" id="termsOfService" name="termsOfService" />
          <Label htmlFor="termsOfService">이용약관에 동의합니다</Label>
          <Button type="button" variant="ghost" size="sm">
            이용약관 보기
          </Button>
        </div>

        <div className="space-y-4 flex-1">
          <input type="checkbox" id="privacyPolicy" name="privacyPolicy" />
          <Label htmlFor="privacyPolicy">개인정보 처리방침에 동의합니다</Label>
          <Button type="button" variant="ghost" size="sm">
            개인정보처리방침 보기
          </Button>
        </div>
      </div>

      <Button type="submit">회원가입</Button>
    </form>
  );
}
