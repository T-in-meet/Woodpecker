import { CalendarCheck, FileCheck, NotebookPen } from "lucide-react"; // shadcn/ui 세팅 시 기본으로 같이 설치되는 아이콘 라이브러리
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";

const features = [
  {
    icon: NotebookPen,
    title: "기록",
    description:
      "마크다운과 코드 구문 강조를 지원하는 에디터로 학습 내용을 깔끔하게 기록하세요.",
  },
  {
    icon: CalendarCheck,
    title: "1-3-7 반복 스케줄링",
    description:
      "기록한 날을 기준으로 1일, 3일, 7일 뒤에 자동으로 복습 알림을 보내드려요.",
  },
  {
    icon: FileCheck,
    title: "백지 테스트",
    description:
      "빈 화면에 다시 작성해보고, 원문과 나란히 비교하며 기억을 확인하세요.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href={ROUTES.HOME} className="font-mono text-lg font-bold">
            딱다구리
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.LOGIN}>로그인</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={ROUTES.SIGNUP}>시작하기</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          기록하고,
          <br />
          잊어버리기 전에 꺼내보세요
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
          딱다구리는 개발 공부를 기록하고, 1-3-7일 간격의 백지 테스트로
          <br className="hidden md:block" />
          기억을 확실하게 만들어주는 인출 학습 서비스입니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="#features">더 알아보기</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            왜 딱다구리인가요?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            읽기만 하는 공부는 금방 잊혀져요. 직접 꺼내봐야 기억에 남습니다.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardHeader>
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="mt-2">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Footer */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">지금 바로 시작하세요</h2>
        <p className="mt-2 text-muted-foreground">
          무료로 가입하고 오늘 배운 내용부터 기록해보세요.
        </p>
        <div className="mt-6">
          <Button size="lg" asChild>
            <Link href={ROUTES.SIGNUP}>무료로 시작하기</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <p className="text-sm text-muted-foreground">
            &copy; 2025 딱다구리. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
