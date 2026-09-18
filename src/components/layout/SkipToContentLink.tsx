export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only left-4 top-4 z-[100] cursor-pointer rounded-md bg-background text-foreground shadow-md focus:not-sr-only focus:fixed focus:px-4 focus:py-3 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      본문 바로가기
    </a>
  );
}
