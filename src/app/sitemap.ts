// sitemap: 검색엔진에 노출시키고 싶은 페이지 목록

import type { MetadataRoute } from "next";

const SITE_URL = "https://woodpecker-app.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
