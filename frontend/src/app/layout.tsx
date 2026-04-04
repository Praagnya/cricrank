import type { Metadata } from "next";
import "./globals.css";
import { Bebas_Neue, Inter, Chakra_Petch } from "next/font/google";
import BottomNav from "@/components/BottomNav";

const heading = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const gaming = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-gaming",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CricRank — Master the Game",
  description: "The ultimate platform for cricket fans. Prove your expertise, top the leaderboard, and claim your glory. No odds. Just skill.",
  openGraph: {
    title: "CricRank — Master the Game",
    description: "The ultimate platform for cricket fans. Prove your expertise, top the leaderboard, and claim your glory. No odds. Just skill.",
    siteName: "CricRank",
    type: "website",
    url: "https://cricrank.com",
  },
  twitter: {
    card: "summary",
    title: "CricRank — Master the Game",
    description: "The ultimate platform for cricket fans. Prove your expertise, top the leaderboard, and claim your glory. No odds. Just skill.",
  },
};

export const viewport: import("next").Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${heading.variable} ${sans.variable} ${gaming.variable}`}>
      <body className="min-h-full flex flex-col antialiased pb-16 lg:pb-0">
        {children}
        <footer className="hidden lg:block border-t border-[#262626] bg-[#000000] py-4 px-6 text-center">
          <p className="text-[10px] text-[#525252] font-bold tracking-widest uppercase">© 2026 CricRank</p>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
