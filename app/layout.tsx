import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Provider } from "./provider";

// Inter is the UI typeface (body + headings). IBM Plex Sans is kept only for the
// chat feed so message density stays unchanged; IBM Plex Mono for numbers/labels.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Prismarity",
  description: "Unified broadcast control for streamers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
