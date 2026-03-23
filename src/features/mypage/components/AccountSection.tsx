"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { changePasswordAction, logoutAction } from "../actions";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function AccountSection() {
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(
    changePasswordAction,
    null,
  );
  const [isLogoutPending, startLogoutTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
        <CardTitle>계정 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-4 text-sm font-medium">비밀번호 변경</h4>
          <form action={passwordFormAction} className="space-y-3">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <Button type="submit" size="sm" disabled={isPasswordPending}>
              {isPasswordPending ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </form>
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-medium">로그아웃</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            현재 기기에서 로그아웃합니다.
          </p>
          <form
            action={() => {
              startLogoutTransition(async () => {
                await logoutAction();
              });
            }}
          >
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isLogoutPending}
            >
              {isLogoutPending ? "로그아웃 중..." : "로그아웃"}
            </Button>
          </form>
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-medium text-destructive">
            계정 삭제
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            계정 삭제
          </Button>
          <DeleteAccountDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          />
        </div>
      </CardContent>
    </Card>
  );
}
