"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { RouteGuard } from "@/components/RouteGuard";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 min-h-screen`}
      >
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 transition-all duration-300 hover:shadow-3xl">
              <CardContent className="p-8">
                <RouteGuard>{children}</RouteGuard>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
