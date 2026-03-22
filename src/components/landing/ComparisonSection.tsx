import { Check, X } from "lucide-react";

const beforeItems = [
  "공부한 내용을 며칠 뒤 까먹음",
  "복습 타이밍을 스스로 정해야 함",
  "노트 앱, 캘린더, 알림 따로 관리",
  "복습했는지 안 했는지 확인 어려움",
  "열심히 했는데 실력이 안 느는 느낌",
] as const;

const afterItems = [
  "과학적 간격으로 기억 유지",
  "1-3-7일 자동 복습 스케줄링",
  "기록부터 복습까지 한 곳에서",
  "백지 테스트로 진짜 기억인지 확인",
  "반복할수록 장기 기억으로 전환",
] as const;

export function ComparisonSection() {
  return (
    <section id="comparison" className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          왜 딱다구리인가요?
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          기존 학습 vs 딱다구리
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          딱다구리는 같은 자리를 반복적으로 쪼아 마침내 나무에 구멍을 냅니다.
          <br />한 번 쪼아서는 구멍이 나지 않듯, 기억도 반복해야 깊이
          새겨집니다.
        </p>

        {/* Before / After 비교 */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Before */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/30 dark:bg-red-950/20">
            <div className="mb-4 inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
              기존 학습
            </div>
            <ul className="space-y-3">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X className="mt-0.5 size-5 shrink-0 text-red-500" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 dark:border-green-900/30 dark:bg-green-950/20">
            <div className="mb-4 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              딱다구리
            </div>
            <ul className="space-y-3">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-green-500" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
