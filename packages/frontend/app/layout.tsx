import "./globals.css";
import type { Metadata } from 'next';
import GlobalInitializer from "./global-initializer";
import RootProvider from "./root-provider";
import PluginLoader from "./plugin-loader";
import ThemeAssets from "@/components/theme-assets";
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { PluginInjectionRenderer } from '@/lib/plugin-injection-renderer';

export const metadata: Metadata = {
  title: {
    default: 'Atlantis',
    template: '%s | Atlantis',
  },
  description: 'Atlantis by Fromcode — the open-source application framework for building scalable products.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/brand/atlantis-mark-indigo.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
  const [headElements, bodyStartElements, documentLocale] = await Promise.all([
    PluginInjectionRenderer.loadHeadElements(),
    PluginInjectionRenderer.loadBodyStartElements(),
    FrontendLocaleService.resolveLocale(undefined, undefined, routingConfig.strategy),
  ]);

  return (
    <html lang={documentLocale} suppressHydrationWarning>
      <head>
        <ThemeAssets />
        {headElements}
      </head>
      <body>
        {bodyStartElements}
        <GlobalInitializer />
        <RootProvider>
          <PluginLoader />
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
