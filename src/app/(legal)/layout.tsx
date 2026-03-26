import { Noto_Serif_KR } from "next/font/google";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

const notoSerifKR = Noto_Serif_KR({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-kr",
  display: "swap",
  preload: false,
});

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen ${notoSerifKR.variable}`}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
