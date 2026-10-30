import type { Metadata } from "next";
// Fonts are bundled with the app (no Google Fonts request), so it works offline on game day.
import "@fontsource/anton/latin-400.css";
import "@fontsource-variable/geist/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cody Feud",
  description: "A survey-says game show for the Cody team, with a host panel, big-screen board and soundboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
