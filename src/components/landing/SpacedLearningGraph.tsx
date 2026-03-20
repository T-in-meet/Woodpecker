const highlights = [
  "복습할 때마다 기억이 이전보다 높은 지점에서 회복됩니다",
  "간격이 길어질수록 장기 기억으로 굳어집니다",
];

export function SpacedLearningGraph() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left: text */}
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              간격 반복 학습 (Spaced Repetition)
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              반복할수록
              <br />더 오래 기억됩니다
            </h2>
            <p className="mt-4 text-muted-foreground">
              간격을 두고 복습할수록 기억 강도가 이전보다 높은 수준에서
              회복됩니다.
            </p>
            <ul className="mt-6 space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    ✓
                  </span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: SVG graph */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <svg
              viewBox="0 0 400 225"
              className="w-full"
              aria-label="간격 학습 효과 그래프"
            >
              {/* Y axis */}
              <line
                x1="50"
                y1="20"
                x2="50"
                y2="170"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.2"
              />
              {/* X axis */}
              <line
                x1="50"
                y1="170"
                x2="390"
                y2="170"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.2"
              />

              {/* Y axis grid lines + labels */}
              {[
                { value: 100, y: 20 },
                { value: 50, y: 95 },
                { value: 0, y: 170 },
              ].map(({ value, y }) => (
                <g key={value}>
                  <line
                    x1="50"
                    y1={y}
                    x2="390"
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    opacity="0.1"
                    strokeDasharray="4,4"
                  />
                  <text
                    x="42"
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.5"
                  >
                    {value}%
                  </text>
                </g>
              ))}

              {/* X axis labels */}
              {[
                { label: "오늘", x: 50 },
                { label: "1일 후", x: 160 },
                { label: "3일 후", x: 270 },
                { label: "7일 후", x: 380 },
              ].map(({ label, x }) => (
                <g key={label}>
                  <line
                    x1={x}
                    y1="170"
                    x2={x}
                    y2="176"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.2"
                  />
                  <text
                    x={x}
                    y="190"
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    opacity="0.5"
                  >
                    {label}
                  </text>
                </g>
              ))}

              {/* Forgetting curve — no review (gray dashed) */}
              <path
                d="M 50,20 C 100,28 130,57 160,65 C 200,73 235,88 270,95 C 315,102 350,118 380,125"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="6,3"
              />

              {/* Spaced repetition curve — 딱다구리 (blue) */}
              <path
                d="M 50,20 C 90,27 130,55 150,62 L 160,35 C 195,41 235,49 260,53 L 270,28 C 305,34 350,44 370,47 L 380,23"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {/* Review point dots */}
              {[
                { cx: 160, cy: 35 },
                { cx: 270, cy: 28 },
                { cx: 380, cy: 23 },
              ].map(({ cx, cy }) => (
                <g key={cx}>
                  <circle cx={cx} cy={cy} r="6" fill="#2563eb" opacity="0.15" />
                  <circle cx={cx} cy={cy} r="3.5" fill="#2563eb" />
                </g>
              ))}

              {/* Legend */}
              <line
                x1="55"
                y1="212"
                x2="78"
                y2="212"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="6,3"
              />
              <text x="84" y="216" fontSize="10" fill="currentColor" opacity="0.5">
                복습 없을 때
              </text>
              <line
                x1="190"
                y1="212"
                x2="213"
                y2="212"
                stroke="#2563eb"
                strokeWidth="2.5"
              />
              <circle cx="202" cy="212" r="3" fill="#2563eb" />
              <text x="219" y="216" fontSize="10" fill="currentColor" opacity="0.5">
                딱다구리 사용 시
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
