import type { Metadata } from "next";
import "./globals.css";
import GlobalInitializer from "./global-initializer";
import RootProvider from "./root-provider";
import PluginLoader from "./plugin-loader";
import ThemeAssets from "@/components/theme-assets";

export const metadata: Metadata = {
  title: "Fromcode Frontend",
  description: "Next.js 15 App Router Frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeAssets />
      </head>
      <body>
        <GlobalInitializer />
        <RootProvider>
          <PluginLoader />
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

