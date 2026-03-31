import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CtaSection } from "@/features/landing/CtaSection";
import { faqs, FaqSection } from "@/features/landing/FaqSection";
import { HeroSection } from "@/features/landing/HeroSection";
import { LearningFlowSection } from "@/features/landing/LearningFlowSection";

const SITE_URL = "https://woodpecker-app.vercel.app";

/* ─── JSON-LD 구조화 데이터 ────────────────────────────────────────────────────
   JSON-LD는 검색엔진(구글 등)에게 "이 페이지가 무엇인지"를 기계가 이해할 수 있는
   형식으로 명시적으로 알려주는 데이터다.
   일반 <meta> 태그가 사람이 읽는 텍스트를 제공한다면,
   JSON-LD는 검색엔진이 페이지의 의미를 확신할 수 있도록 돕는다.

   @graph 배열 안에 여러 객체({ })를 담아 하나의 페이지에 여러 정보를 동시에 전달함.
   각 객체는 @type으로 종류를 선언하고, @id로 서로 참조해 관계를 표현할 수 있다.

   실질적인 효과:
   - WebSite: 구글이 딱다구리를 독립적인 브랜드 엔티티로 인식하게 함
   - WebApplication: 앱의 카테고리·가격·기능이 구조화되어 검색 결과에 반영될 수 있음
   - FAQPage: 구글 검색 결과에 Q&A가 직접 펼쳐지는 "리치 결과"로 표시될 수 있음
               → 클릭율(CTR) 향상에 가장 직접적인 효과
─────────────────────────────────────────────────────────────────────────── */
const jsonLd = {
  // schema.org: 구글·MS·야후 등이 공동으로 만든 구조화 데이터 표준 어휘집
  "@context": "https://schema.org",
  "@graph": [
    // ── 1. WebSite: 사이트 전체의 아이덴티티를 정의 ──────────────────────────
    // 구글이 "딱다구리"를 하나의 브랜드로 인식하는 기반이 됨.
    // 아래 WebApplication·FAQPage 노드가 isPartOf로 이 노드를 참조해 소속을 명시함.
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`, // 이 노드의 고유 식별자 (다른 노드에서 참조용)
      name: "딱다구리",
      url: SITE_URL,
      inLanguage: "ko",
      description: "기록이 기억이 되는 간격 반복 학습 공간",
    },

    // ── 2. WebApplication: 딱다구리가 어떤 앱인지 상세 정보 전달 ─────────────
    // applicationCategory, operatingSystem, offers 등으로 앱의 성격을 명확히 함.
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "딱다구리",
      url: SITE_URL,
      image: `${SITE_URL}/og-image.png`,
      inLanguage: "ko",
      applicationCategory: "EducationalApplication", // 교육용 앱으로 분류
      operatingSystem: "Web",
      isPartOf: { "@id": `${SITE_URL}/#website` }, // WebSite 노드와 연결
      description:
        "기록한 순간부터 복습이 설계됩니다. 인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 학습 내용을 장기 기억으로 전환하세요.",
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

    // ── 3. FAQPage: 랜딩 페이지의 FAQ 섹션을 구조화 ─────────────────────────
    // 구글이 이 데이터를 인식하면 검색 결과에서 질문·답변이 바로 펼쳐지는
    // "리치 결과(Rich Results)"로 표시될 수 있음 → 클릭율 향상에 직접 기여.
    // faqs 배열은 FaqSection 컴포넌트와 동일한 데이터를 공유해 일관성을 유지함.
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen">
        <Header />
        <main>
          <HeroSection />
          <LearningFlowSection />
          <FaqSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
