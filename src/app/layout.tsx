import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { InstallBanner } from "./InstallBanner";
import { NavProgress } from "@/components/NavProgress";

export const metadata: Metadata = {
  title: "Rasi Aksara",
  description: "Sistem operasional Rasi Aksara",
  // Installed on the home screen it opens full screen; iPhones need this for notifications (iOS 16.4+).
  appleWebApp: { capable: true, title: "Rasi Aksara", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "only light", themeColor: "#f3f5f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
