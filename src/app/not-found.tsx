import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

/* 이 페이지는 HTTP 404로 응답하므로 색인될 일은 없다. 그럼에도 metadata를 두는
   이유는, 없으면 루트 레이아웃의 title(홈 타이틀)·description(랜딩 설명)·
   robots(index: true)를 그대로 물려받아 "여기 홈 페이지가 있고 색인해도 된다"는
   신호를 404 본문에 실어 보내게 되기 때문이다. 404 응답과 서로 어긋나는 신호다. */
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  description: "요청하신 페이지가 없거나 주소가 바뀌었습니다.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          요청하신 페이지가 없거나 주소가 바뀌었습니다.
        </p>
      </div>
      {/* 막다른 길을 남기지 않는다. 사용자와 크롤러 모두 여기서 사이트로 돌아갈
          경로가 있어야 한다. */}
      <Button asChild variant="outline" size="md">
        <Link href={ROUTES.HOME}>홈으로 가기</Link>
      </Button>
    </div>
  );
}
