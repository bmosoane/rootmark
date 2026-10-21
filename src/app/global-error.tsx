"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unexpected application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={bodyStyles}>
        <title>Something went wrong — Rootmark</title>
        <main style={cardStyles}>
          <strong style={brandStyles}>Rootmark</strong>
          <h1 style={headingStyles}>Something went wrong</h1>
          <p style={copyStyles}>
            We could not display Rootmark. Your domain records have not been
            changed.
          </p>
          <button style={buttonStyles} type="button" onClick={retry}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

const bodyStyles = {
  alignItems: "center",
  background: "#f6f8fb",
  color: "#172033",
  display: "flex",
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  justifyContent: "center",
  margin: 0,
  minHeight: "100vh",
  padding: "24px",
} as const;

const cardStyles = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  maxWidth: "520px",
  padding: "32px",
  textAlign: "center",
  width: "100%",
} as const;

const brandStyles = {
  display: "block",
  fontSize: "14px",
  marginBottom: "28px",
} as const;

const headingStyles = {
  fontSize: "22px",
  margin: 0,
} as const;

const copyStyles = {
  color: "#536170",
  fontSize: "14px",
  lineHeight: 1.6,
  margin: "10px 0 22px",
} as const;

const buttonStyles = {
  background: "#1d4ed8",
  border: "1px solid #1d4ed8",
  borderRadius: "8px",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
  minHeight: "40px",
  padding: "0 16px",
} as const;
