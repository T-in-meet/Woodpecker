import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/(auth)/", "/(main)/"],
      },
    ],
    sitemap: "https://woodpecker-app.vercel.app/sitemap.xml",
  };
}
