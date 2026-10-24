import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KEY AND GO",        // change to your real app name
    short_name: "Driver Hire",
    description: "Hire a verified driver for any task or occasion.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7ff",
    theme_color: "#4338ca",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}