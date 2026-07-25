import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { Provider } from "./provider";
import { ThemeScript } from "./_ctx/color-mode";

// M PLUS Rounded 1c is the single app-wide typeface (body, headings, AND the
// number/label "mono" slot) — a rounded, SF-Rounded-like face. It has no 600
// weight (100/300/400/500/700/800/900), so any 600 in the UI maps to 700.
const rounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-rounded",
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
    <html lang="en" suppressHydrationWarning className={rounded.variable}>
      {/* `chakra-theme` is required for Chakra v3's dark tokens to apply: it
          emits the dark overrides as `.dark .chakra-theme:not(.light)`, so the
          `.dark` class the color-mode script puts on <html> only takes effect
          when a descendant carries `chakra-theme`. Without it the app is stuck
          on the light `:root` values. */}
      <body className="chakra-theme">
        {/* Sets the light/dark class before first paint (no flash). Executes at
            HTML-parse time on the server; inert on the client. See ThemeScript. */}
        <ThemeScript />
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
