import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Jarvis AI OS",
  description: "Your knowledge, your work, one operating system.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-canvas font-sans text-ink antialiased">
        <div className="flex h-screen flex-col overflow-hidden bg-canvas">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-auto">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
