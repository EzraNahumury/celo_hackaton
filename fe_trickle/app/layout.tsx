import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { AnimatedBackground } from "@/components/ui/animated-background";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-jb",
});

export const metadata: Metadata = {
  title: "Trickle",
  description:
    "Real-time salary streaming powered by Celo stablecoins. Get paid every second.",
  manifest: "/manifest.json",
  verification: {
    other: {
      "talentapp:project_verification":
        "e91424fb6c4fe298e3f347e6b5c51a5b498904436c99053b718542c7586d4881405c7a3d8186118dd58793c81faf62191d3b2ca0e465a3e5fbb7da7f739f30d9",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full text-fg font-sans"
      >
        <AnimatedBackground />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
