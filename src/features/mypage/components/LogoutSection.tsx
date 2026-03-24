"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { logoutAction } from "../actions";

export function LogoutSection() {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>로그아웃</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          현재 기기에서 로그아웃합니다.
        </p>
        <form
          action={() => {
            startTransition(async () => {
              await logoutAction();
            });
          }}
        >
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isPending}
          >
            {isPending ? "로그아웃 중..." : "로그아웃"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
