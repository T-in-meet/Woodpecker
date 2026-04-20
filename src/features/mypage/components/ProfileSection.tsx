"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types/profiles.types";

import {
  deleteAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "../actions";

type ProfileSectionProps = {
  profile: Profile;
  email: string;
};

export function ProfileSection({ profile, email }: ProfileSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isPendingAvatar, startAvatarTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    const formData = new FormData();
    formData.set("avatar", file);

    startAvatarTransition(async () => {
      try {
        const result = await uploadAvatarAction(null, formData);
        if (result?.data) {
          router.refresh();
        } else if (result?.error) {
          setAvatarError(
            typeof result.error === "string"
              ? result.error
              : "업로드에 실패했습니다",
          );
        }
      } catch {
        setAvatarError("업로드에 실패했습니다");
      }
    });

    e.target.value = "";
  };

  const handleDeleteAvatar = () => {
    setAvatarError(null);
    startAvatarTransition(async () => {
      try {
        const result = await deleteAvatarAction();
        if (result?.data) {
          router.refresh();
        } else if (result?.error) {
          setAvatarError(
            typeof result.error === "string"
              ? result.error
              : "삭제에 실패했습니다",
          );
        }
      } catch {
        setAvatarError("삭제에 실패했습니다");
      }
    });
  };

  const avatarDisplay = profile.avatar_url ? (
    <Image
      src={profile.avatar_url}
      alt={profile.nickname}
      width={48}
      height={48}
      className="size-12 rounded-full object-cover"
    />
  ) : (
    <div className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
      {profile.nickname.charAt(0)}
    </div>
  );

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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>아바타</Label>
              <div className="flex items-center gap-3">
                {avatarDisplay}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPendingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isPendingAvatar ? "처리 중..." : "변경"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isPendingAvatar}
                  />
                  {profile.avatar_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPendingAvatar}
                      onClick={handleDeleteAvatar}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </div>
              {avatarError && (
                <p className="text-sm text-destructive">{avatarError}</p>
              )}
            </div>
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
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {avatarDisplay}
            <div className="space-y-1">
              <p className="font-medium">{profile.nickname}</p>
              <p className="text-sm text-muted-foreground">
                {profile.role === "ADMIN" ? "관리자" : ""}
              </p>
              <p className="text-xs text-muted-foreground">{email}</p>
              <p className="text-xs text-muted-foreground">
                가입일{" "}
                {new Date(profile.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
