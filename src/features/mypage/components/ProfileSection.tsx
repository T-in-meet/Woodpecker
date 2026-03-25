"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types/profiles.types";

import { updateProfileAction } from "../actions";

type ProfileSectionProps = {
  profile: Profile;
  email: string;
};

export function ProfileSection({ profile, email }: ProfileSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      const result = await updateProfileAction(prevState, formData);
      if (result?.data) {
        setIsEditing(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>프로필</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              수정
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임</Label>
              <Input
                id="nickname"
                name="nickname"
                defaultValue={profile.nickname}
                maxLength={10}
                placeholder="닉네임 (1~10자)"
              />
              {fieldErrors?.nickname && (
                <p className="text-sm text-destructive">
                  {fieldErrors.nickname[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">아바타 URL</Label>
              <Input
                id="avatarUrl"
                name="avatarUrl"
                defaultValue={profile.avatar_url ?? ""}
                placeholder="https://example.com/avatar.png"
              />
              {fieldErrors?.avatarUrl && (
                <p className="text-sm text-destructive">
                  {fieldErrors.avatarUrl[0]}
                </p>
              )}
            </div>
            {generalError && (
              <p className="text-sm text-destructive">{generalError}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "저장 중..." : "저장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                취소
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {profile.nickname.charAt(0)}
            </div>
            <div className="space-y-1">
              <p className="font-medium">{profile.nickname}</p>
              <p className="text-sm text-muted-foreground">
                {profile.role === "ADMIN" ? "관리자" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                이메일 주소:{email}
              </p>
              <p className="text-xs text-muted-foreground">
                가입일:{" "}
                {new Date(profile.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
