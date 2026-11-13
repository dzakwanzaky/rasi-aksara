import type { MetadataRoute } from "next";

// Makes the web app installable on phones (Add to Home Screen), which iPhones require for notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rasi Aksara Operasional",
    short_name: "Rasi Aksara",
    description: "Sistem operasional Rasi Aksara",
    id: "/",
    start_url: "/checklist",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f1",
    theme_color: "#f3f5f1",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
