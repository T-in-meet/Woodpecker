import { CtaSection } from "@/components/landing/CtaSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { LearningFlowSection } from "@/components/landing/LearningFlowSection";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <LearningFlowSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
