import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/notes",
          "/mypage",
          "/records",
        ],
      },
    ],
    sitemap: "https://woodpecker-app.vercel.app/sitemap.xml",
  };
}
