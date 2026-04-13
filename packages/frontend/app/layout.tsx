import "./globals.css";
import type { Metadata } from 'next';
import GlobalInitializer from "./global-initializer";
import RootProvider from "./root-provider";
import PluginLoader from "./plugin-loader";
import ThemeAssets from "@/components/theme-assets";

export const metadata: Metadata = {
  title: {
    default: 'Atlantis Framework',
    template: '%s | Atlantis Framework',
  },
  description: 'Atlantis is the open-source application framework by Fromcode for building scalable applications.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/brand/atlantis-mark-indigo.png',
  },
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
