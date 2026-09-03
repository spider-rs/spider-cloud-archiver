import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Spider Archiver";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-200px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,222,119,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <svg
          width="80"
          height="76"
          viewBox="0 0 24 24"
          fill="#3bde77"
          style={{ marginBottom: "32px" }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M20.646 5.196A2.25 2.25 0 0 0 17.199 2.304L15.447 4.391A4.5 4.5 0 0 1 8.553 4.391L6.801 2.304A2.25 2.25 0 0 0 3.354 5.196L8.697 11.564A4.5 4.5 0 0 1 9.75 14.457L9.75 20.25A2.25 2.25 0 0 0 14.25 20.25L14.25 14.457A4.5 4.5 0 0 1 15.303 11.564L20.646 5.196Z"
          />
        </svg>
        <div
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: "16px",
            display: "flex",
          }}
        >
          Spider Archiver
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "rgba(255,255,255,0.6)",
            maxWidth: "700px",
            textAlign: "center",
            lineHeight: 1.4,
            display: "flex",
          }}
        >
          Crawl & archive any website. Save, browse, and inspect HTML source.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "rgba(59,222,119,0.8)",
            fontSize: "18px",
            fontWeight: 500,
          }}
        >
          spider.cloud
        </div>
      </div>
    ),
    { ...size }
  );
}
