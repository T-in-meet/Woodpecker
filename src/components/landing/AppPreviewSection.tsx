export function AppPreviewSection() {
  return (
    <section className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          직접 확인해보세요
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          심플하고 직관적인 학습 도구
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          복잡한 설정 없이 기록하고 복습하세요.
          <br className="hidden md:block" />
          딱다구리가 최적의 타이밍에 복습을 안내합니다.
        </p>

        {/* App mockup placeholder */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
              <div className="size-3 rounded-full bg-red-400/60" />
              <div className="size-3 rounded-full bg-yellow-400/60" />
              <div className="size-3 rounded-full bg-green-400/60" />
              <span className="ml-2 text-xs text-muted-foreground">
                딱다구리 — 대시보드
              </span>
            </div>

            {/* Mock dashboard content */}
            <div className="p-6">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">오늘의 복습</p>
                  <p className="mt-1 text-2xl font-bold">3</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">총 기록</p>
                  <p className="mt-1 text-2xl font-bold">24</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">완료율</p>
                  <p className="mt-1 text-2xl font-bold">87%</p>
                </div>
              </div>

              {/* Mock record list */}
              <div className="mt-6 space-y-3">
                {[
                  {
                    title: "TCP 3-way Handshake",
                    tag: "오늘 복습",
                    tagColor: "bg-blue-100 text-blue-700",
                  },
                  {
                    title: "Git rebase vs merge 차이",
                    tag: "3일 후 복습",
                    tagColor: "bg-amber-100 text-amber-700",
                  },
                  {
                    title: "REST API 설계 원칙",
                    tag: "완료",
                    tagColor: "bg-green-100 text-green-700",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center justify-between rounded-lg border bg-background px-4 py-3"
                  >
                    <span className="text-sm font-medium">{item.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.tagColor}`}
                    >
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
