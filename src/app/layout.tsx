import type { Metadata } from "next";
import { Barlow_Condensed, Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth", "opsz"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "foodprice", template: "%s · foodprice" },
  description: "What your food really costs — prices, member offers and macros for groceries and recipes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          <Sidebar />
          <div className="lg:pl-64">
            <main className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-8 lg:pb-16 lg:pt-10">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
