"use client";
import { useState } from "react";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#14b8a6", "#f97316"];

function tone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export default function Avatar({
  src,
  name,
  size = 44,
  ring,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: string; // a colour: draws a thin ring around the picture
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const label = (name ?? "").trim();
  const showImg = !!src && failed !== src; // a new picture link gets a fresh try
  const color = tone(label || "?");
  const pad = ring ? 2 : 0;
  const inner = size - pad * 2;

  return (
    <span
      role="img"
      aria-label={label ? `${label}, profile picture` : "Profile picture"}
      className={`relative inline-flex shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, padding: pad, background: ring }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src as string)}
          className="block w-full h-full rounded-full object-cover"
        />
      ) : (
        <span
          className="flex w-full h-full items-center justify-center rounded-full font-extrabold text-white"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #0e7490))`,
            fontSize: inner * 0.42,
          }}
        >
          {label ? (
            label.charAt(0).toUpperCase()
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={inner * 0.55}
              height={inner * 0.55}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ display: "block" }}
            >
              <path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1" />
              <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          )}
        </span>
      )}
    </span>
  );
}