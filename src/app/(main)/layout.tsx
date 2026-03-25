import { Header } from "@/components/layout/Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
