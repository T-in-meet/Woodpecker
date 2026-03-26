const scenes = [
  {
    step: "01",
    eyebrow: "기록",
    title: "적는 순간,\n복습이 설계됩니다",
    description:
      "노트를 저장하는 순간, 복습 일정이 자동으로 잡힙니다. 캘린더를 따로 쓰거나 알림을 설정할 필요 없어요. 기록만 하면 딱다구리가 나머지를 챙깁니다.",
    mockup: <NoteMockup />,
    reverse: false,
  },
  {
    step: "02",
    eyebrow: "알림",
    title: "잊어버리기 직전,\n딱 맞춰 알려드려요",
    description:
      "복습은 '해야지' 생각만으로는 잘 안 됩니다. 간격을 두고 반복할수록 기억이 오래 간다는 건 인지과학이 검증한 원리입니다. 딱다구리가 딱 그 타이밍에 먼저 찾아갑니다.",
    mockup: <NotificationMockup />,
    reverse: true,
  },
  {
    step: "03",
    eyebrow: "백지 테스트",
    title: "다시 읽는 게 아니라,\n직접 꺼내야 기억됩니다",
    description:
      "빈 화면에 기억나는 대로 써보세요. 작성 후 원문과 나란히 비교하며 실제로 내가 알고 있는지 확인할 수 있습니다.",
    mockup: <TestMockup />,
    reverse: false,
  },
] as const;

function NoteMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="size-2.5 rounded-full bg-red-400/60" />
        <div className="size-2.5 rounded-full bg-yellow-400/60" />
        <div className="size-2.5 rounded-full bg-green-400/60" />
        <span className="ml-2 text-xs text-muted-foreground">새 노트</span>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold">클로저(Closure)란?</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          함수가 자신이 생성될 때의 스코프를 기억하여, 스코프 밖에서
          호출되더라도 해당 스코프에 접근할 수 있는 것.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-orange-200 bg-orange-50/60 px-3 py-2.5 dark:border-orange-800/30 dark:bg-orange-950/20">
          <span className="text-base">📅</span>
          <div>
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
              복습 일정이 자동으로 잡혔어요
            </p>
            <p className="text-xs text-muted-foreground">
              1일 후 · 3일 후 · 7일 후
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-2.5 w-3/4 rounded-full bg-muted" />
          <div className="h-2.5 w-1/2 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

function NotificationMockup() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
          <div className="size-2.5 rounded-full bg-red-400/60" />
          <div className="size-2.5 rounded-full bg-yellow-400/60" />
          <div className="size-2.5 rounded-full bg-green-400/60" />
          <span className="ml-2 text-xs text-muted-foreground">딱다구리</span>
        </div>
        <div className="divide-y">
          {[
            {
              title: "클로저(Closure)란?",
              badge: "오늘 복습",
              badgeColor:
                "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
            },
            {
              title: "React useEffect 생명주기",
              badge: "내일 복습",
              badgeColor: "bg-muted text-muted-foreground",
            },
            {
              title: "프로미스(Promise) 체이닝",
              badge: "6일 후",
              badgeColor: "bg-muted text-muted-foreground",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between px-5 py-3"
            >
              <p className="text-sm">{item.title}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-md">
        <span className="mt-0.5 text-xl">🔔</span>
        <div>
          <p className="text-xs text-muted-foreground">딱다구리 · 지금</p>
          <p className="mt-0.5 text-sm font-semibold">복습할 시간이에요!</p>
          <p className="text-xs text-muted-foreground">
            클로저(Closure) — 기억나시나요?
          </p>
        </div>
      </div>
    </div>
  );
}

function TestMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="size-2.5 rounded-full bg-red-400/60" />
        <div className="size-2.5 rounded-full bg-yellow-400/60" />
        <div className="size-2.5 rounded-full bg-green-400/60" />
        <span className="ml-2 text-xs text-muted-foreground">백지 테스트</span>
      </div>
      <div className="grid divide-x md:grid-cols-2">
        {/* 내 답변 */}
        <div className="p-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            내 답변
          </p>
          <p className="text-sm leading-relaxed">
            클로저는 함수가 선언될 때의 렉시컬 환경을 기억하는 것. 외부 함수가
            종료된 후에도 내부 함수에서 접근 가능.
          </p>
          <div className="mt-4 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">
              핵심 개념 포함
            </span>
          </div>
        </div>
        {/* 원문 */}
        <div className="bg-muted/30 p-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground">원문</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            함수가 자신이 생성될 때의 스코프를 기억하여, 스코프 밖에서
            호출되더라도 해당 스코프에 접근할 수 있는 것.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LearningFlowSection() {
  return (
    <section id="features">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          오늘 공부한 내용, <br /> 일주일 뒤에도 기억나시나요?
        </h2>

        {/* 과학적 근거 수치 카드 */}
        <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 text-center">
            <p className="text-3xl font-bold tracking-tight">67%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              학습 후 24시간 내 망각되는 정보량
            </p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Ebbinghaus (1885)
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 text-center">
            <p className="text-3xl font-bold tracking-tight">+50%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              인출 연습 시 1주일 후 기억 유지량 증가
            </p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Karpicke &amp; Blunt (2011)
            </p>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-muted-foreground">
          딱다구리는 인지과학이 검증한 두 가지 원리,
          <br /> <b>간격 반복</b>과 <b>인출 연습</b>을 세 단계로 구현합니다.
        </p>

        <div className="mt-20 space-y-24">
          {scenes.map((scene) => (
            <div
              key={scene.step}
              className={`flex flex-col gap-10 md:flex-row md:items-center md:gap-16 ${
                scene.reverse ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Text */}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-orange-200 dark:text-orange-900">
                    {scene.step}
                  </span>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                    {scene.eyebrow}
                  </span>
                </div>
                <h3 className="mt-4 whitespace-pre-line text-2xl font-bold tracking-tight md:text-3xl">
                  {scene.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground md:text-base">
                  {scene.description}
                </p>
              </div>

              {/* Mockup */}
              <div className="flex-1">{scene.mockup}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
