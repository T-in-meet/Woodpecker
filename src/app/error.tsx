"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-7 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">오류가 발생했습니다</h2>
        <p className="text-sm text-muted-foreground">
          일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
      <Button variant="outline" size="md" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
