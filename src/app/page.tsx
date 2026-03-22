import { CtaSection } from "@/components/landing/CtaSection";
import { faqs, FaqSection } from "@/components/landing/FaqSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { LearningFlowSection } from "@/components/landing/LearningFlowSection";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "딱다구리",
      url: "https://woodpecker-app.vercel.app",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description:
        "에빙하우스 망각곡선 기반 1-3-7일 간격 반복과 백지 테스트로 학습 내용을 장기 기억으로 전환하는 학습 플랫폼",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
        description: "베타 기간 무료",
      },
      featureList: [
        "마크다운 기반 학습 기록",
        "1-3-7일 간격 반복 알림",
        "백지 테스트를 통한 인출 연습",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <HeroSection />
        <LearningFlowSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
