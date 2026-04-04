import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CricRank — Master the Game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#000000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(to right, #fbbf24, #f59e0b, #d97706)",
          }}
        />

        {/* Lightning bolt icon */}
        <svg
          viewBox="0 0 24 24"
          width="80"
          height="80"
          fill="white"
          style={{ marginBottom: "24px" }}
        >
          <path d="M13 2 L5 13 L11 13 L9 22 L19 11 L13 11 Z" />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: "900",
            color: "#ffffff",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            lineHeight: 1,
            marginBottom: "20px",
          }}
        >
          CricRank
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#fbbf24",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginBottom: "40px",
          }}
        >
          Master the Game
        </div>

        {/* Divider */}
        <div
          style={{
            width: "120px",
            height: "2px",
            background: "#262626",
            marginBottom: "32px",
          }}
        />

        {/* Description */}
        <div
          style={{
            fontSize: "22px",
            color: "#737373",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: "600",
          }}
        >
          No odds. Just skill.
        </div>

        {/* Bottom border */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "#1a1a1a",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
