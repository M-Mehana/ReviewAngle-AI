import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ReviewAngle AI — Customer evidence, actionable angles",
  description:
    "Turn customer reviews into traceable marketing intelligence in Arabic and English.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
