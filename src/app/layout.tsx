import type { Metadata } from "next";

import { ShowroomHeader } from "@/showroom/showroom-header";

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
      <body className="flex min-h-full flex-col">
        <ShowroomHeader />
        <div className="showroom-content min-w-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
