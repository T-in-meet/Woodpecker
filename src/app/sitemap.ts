// sitemap: 검색엔진에 노출시키고 싶은 페이지 목록

import type { MetadataRoute } from "next";

import { ROUTES } from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${ROUTES.TERMS}`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}${ROUTES.PRIVACY}`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
