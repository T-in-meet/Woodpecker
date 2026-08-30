"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/lib/constants/routes";

import { changePasswordAction } from "../actions";

/** 비밀번호 설정을 마치면 돌아올 마이페이지 계정 관리 화면 */
const SET_PASSWORD_REDIRECT_PATH = `${ROUTES.MYPAGE}?section=profile`;

type AccountSectionProps = {
  /** 이메일/비밀번호 로그인이 연결돼 있는지 여부 */
  hasPasswordLogin: boolean;
};

export function AccountSection({ hasPasswordLogin }: AccountSectionProps) {
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(
    changePasswordAction,
    null,
  );

  const passwordFieldErrors =
    passwordState?.error && typeof passwordState.error === "object"
      ? passwordState.error
      : null;
  const passwordGeneralError =
    passwordState?.error && typeof passwordState.error === "string"
      ? passwordState.error
      : null;
  const passwordSuccess =
    passwordState?.data && "success" in passwordState.data;

  /*
   * 비밀번호 변경은 현재 비밀번호 확인을 거치므로 소셜 로그인만 연결된 계정에서는
   * 성공할 수 없다. 폼 대신 비밀번호를 새로 설정하는 경로를 안내한다.
   */
  if (!hasPasswordLogin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>비밀번호 설정</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent>
          <div className="pt-5">
            <p className="text-prose-ko mb-4 text-sm text-muted-foreground">
              소셜 로그인으로 가입한 계정이라 아직 비밀번호가 없습니다.
              비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있고, 이
              화면에서 비밀번호를 변경할 수 있습니다.
            </p>
            <Button asChild size="md">
              <Link
                className="cursor-pointer"
                href={`${ROUTES.SET_PASSWORD}?redirect=${encodeURIComponent(
                  SET_PASSWORD_REDIRECT_PATH,
                )}`}
              >
                비밀번호 설정하기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 변경</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6">
        <div className="my-5">
          <form action={passwordFormAction} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="현재 비밀번호"
              />
              {passwordFieldErrors?.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordFieldErrors.currentPassword[0]}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
              />
              {passwordFieldErrors?.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordFieldErrors.newPassword[0]}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Label htmlFor="confirmNewPassword">새 비밀번호 확인</Label>
              <Input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                placeholder="새 비밀번호 확인"
              />
              {passwordFieldErrors?.confirmNewPassword && (
                <p className="text-sm text-destructive">
                  {passwordFieldErrors.confirmNewPassword[0]}
                </p>
              )}
            </div>
            {passwordGeneralError && (
              <p className="text-sm text-destructive">{passwordGeneralError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600">
                비밀번호가 변경되었습니다.
              </p>
            )}
            <Button type="submit" size="md" disabled={isPasswordPending}>
              {isPasswordPending ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
