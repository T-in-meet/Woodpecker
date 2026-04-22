import { Suspense } from "react";

import { Header, HeaderSkeleton } from "@/components/layout/Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
