import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CtaSection } from "@/features/landing/CtaSection";
import { faqs, FaqSection } from "@/features/landing/FaqSection";
import { HeroSection } from "@/features/landing/HeroSection";
import { LearningFlowSection } from "@/features/landing/LearningFlowSection";

const SITE_URL = "https://woodpecker-app.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "딱다구리",
      url: SITE_URL,
      image: `${SITE_URL}/og-image.png`,
      inLanguage: "ko",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description:
        "에빙하우스 망각곡선 기반 1-3-7일 간격 반복과 백지 테스트로 학습 내용을 장기 기억으로 전환하는 학습 공간",
      offers: {
        "@type": "Offer",
        price: 0,
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
      "@id": `${SITE_URL}/#faq`,
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
