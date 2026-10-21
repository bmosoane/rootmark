import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rootmark — Domain ownership, on record",
  description:
    "Verify that you control a domain with one transparent DNS challenge.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
