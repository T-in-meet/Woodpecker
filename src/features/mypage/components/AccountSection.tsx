"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { changePasswordAction } from "../actions";

export function AccountSection() {
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
