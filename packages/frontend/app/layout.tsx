import type { Metadata } from "next";
import "./globals.css";
import GlobalInitializer from "./GlobalInitializer";
import RootProvider from "./RootProvider";
import PluginLoader from "./PluginLoader";

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

