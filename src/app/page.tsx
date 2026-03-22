import { AppPreviewSection } from "@/components/landing/AppPreviewSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SpacedLearningGraph } from "@/components/landing/SpacedLearningGraph";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <HowItWorksSection />
      <AppPreviewSection />
      <SpacedLearningGraph />
      <ComparisonSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
