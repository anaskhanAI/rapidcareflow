import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RapidCareFlow — Medical Coding AI",
  description:
    "AI-powered clinical coding platform. Automated ICD-10, CPT, HCPCS, E&M and Modifier extraction.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
