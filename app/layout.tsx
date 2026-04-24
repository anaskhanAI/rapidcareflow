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
      <body>{children}</body>
    </html>
  );
}
