import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    name: "김민수",
    role: "프론트엔드 개발자",
    avatar: "KM",
    quote:
      "기술 면접 준비하면서 매일 한 개씩 기록하고 복습했더니, 3주 만에 확실히 체감이 달라졌어요. 백지 테스트가 진짜 효과 있습니다.",
  },
  {
    name: "이서연",
    role: "대학원생 · 컴퓨터공학",
    avatar: "LS",
    quote:
      "논문 읽으면서 핵심 내용을 기록해두면 알아서 복습 알림이 와요. 시험 기간에 다시 찾아볼 필요가 없어졌습니다.",
  },
  {
    name: "박준혁",
    role: "백엔드 개발자",
    avatar: "PJ",
    quote:
      "노션에 정리만 하고 안 보는 습관이 있었는데, 딱다구리 쓰고 나서 정리한 걸 진짜 복습하게 됐어요. 1-3-7 알림이 핵심입니다.",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          사용자 후기
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          학습자들의 이야기
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name}>
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
