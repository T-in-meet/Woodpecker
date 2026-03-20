import Link from "next/link";

import { CtaSection } from "@/components/landing/CtaSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { SpacedLearningGraph } from "@/components/landing/SpacedLearningGraph";
import { TargetAudience } from "@/components/landing/TargetAudience";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

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

      <HeroSection />
      <FeaturesSection />
      <SpacedLearningGraph />
      <TargetAudience />
      <CtaSection />

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
