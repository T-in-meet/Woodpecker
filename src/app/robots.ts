// robots.ts : 검색엔진 크롤러(Googlebot 등)에게 이 사이트의 크롤링 규칙을 알려주는 지침서.

// Next.js가 이 파일을 /robots.txt로 자동 서빙함.
// 강제성은 없으며, 구글 등 신뢰할 수 있는 봇만 이 규칙을 준수함.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // 모든 크롤러에게 적용 (특정 봇만 지정하려면 "Googlebot" 등으로 변경)
        userAgent: "*",

        // 크롤링을 허용할 경로 ("/"는 전체 허용이 기본값)
        allow: "/",

        // 크롤링을 하지 말아달라고 요청할 경로
        // 로그인이 필요한 페이지나 API는 인덱싱해도 SEO 가치가 없으므로 제외
        disallow: ["/api/", "/login", "/signup", "/records", "/mypage"],
      },
    ],

    // 크롤러에게 sitemap 위치를 알려줌 (색인 효율 향상)
    sitemap: "https://woodpecker-app.vercel.app/sitemap.xml",
  };
}
