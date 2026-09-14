import type { Metadata } from "next";
import { Inter, Manrope, Source_Serif_4 } from "next/font/google";
import { RequestLoaderProvider } from "@/components/RequestLoader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-auth-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-auth-display",
  display: "swap",
});

const siteUrl = (process.env.APP_BASE_URL || "http://localhost:3012").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TalentBridge Admin",
    template: "%s · TalentBridge Admin",
  },
  description: "Platform Admin — Global Admin, Manager, and Support for TalentBridge tenants and help tickets.",
  applicationName: "TalentBridge Admin",
  authors: [{ name: "TalentBridge" }],
  creator: "TalentBridge",
  publisher: "TalentBridge",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "TalentBridge Admin",
    title: "TalentBridge · Platform Admin",
    description:
      "Platform console for TalentBridge. Create tenants, manage entitlement, and handle Help & Support tickets.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TalentBridge Platform Admin",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TalentBridge · Platform Admin",
    description:
      "Platform console for TalentBridge. Create tenants, manage entitlement, and handle Help & Support tickets.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "TalentBridge Platform Admin",
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${sourceSerif.variable}`}>
      <body className="font-sans antialiased">
        <RequestLoaderProvider>{children}</RequestLoaderProvider>
      </body>
    </html>
  );
}
