import type { Metadata } from "next";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "forge-registry",
  description: "Reusable AI website component registry scaffold",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
