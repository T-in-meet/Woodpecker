"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function MypageHeader() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => router.back()}>
        <ArrowLeft className="size-5" />
      </Button>
      <h1 className="text-2xl font-bold">마이페이지</h1>
    </div>
  );
}
