import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RecordsPage() {
  return <div>기록 목록</div>;
}
