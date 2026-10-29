import { ImageResponse } from "next/og";
import { profile } from "@/content/profile";

export const alt = `${profile.name} — ${profile.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for recruiters: the name is the identity, no logo.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 48,
          background: "linear-gradient(160deg, #dcd9d3 0%, #b9b3aa 55%, #7d6656 100%)",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 64,
            borderRadius: 48,
            background: "rgba(40, 40, 46, 0.78)",
            border: "2px solid rgba(255, 255, 255, 0.25)",
            color: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.16)",
              fontSize: 26,
            }}
          >
            Video editing portfolio
          </div>
          <div style={{ marginTop: 28, fontSize: 104, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            {profile.name}
          </div>
          <div style={{ marginTop: 24, fontSize: 34, color: "rgba(255, 255, 255, 0.8)" }}>
            {profile.positioning.join(" · ")}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
