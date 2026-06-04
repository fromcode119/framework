import "./globals.css";
import type { Metadata } from 'next';
import GlobalInitializer from "./global-initializer";
import RootProvider from "./root-provider";
import PluginLoader from "./plugin-loader";
import ThemeAssets from "@/components/theme-assets";
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { PluginInjectionRenderer } from '@/lib/plugin-injection-renderer';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';

export async function generateMetadata(): Promise<Metadata> {
  // Brand defaults come from the SEO plugin settings (site name/description/OG), not a
  // hardcoded value. Per-page generateMetadata overrides title/description/OG with absolute
  // values; these are the site-wide fallbacks.
  const seo = await ResolvedContentMetadata.fetchSite();
  const siteName = seo?.siteName || seo?.title || 'Home';
  const images = seo?.ogImage ? [seo.ogImage] : undefined;
  return {
    title: { default: siteName, template: `%s | ${siteName}` },
    description: seo?.description || undefined,
    openGraph: { siteName, title: siteName, description: seo?.description || undefined, type: 'website', images },
    twitter: { card: 'summary_large_image', title: siteName, description: seo?.description || undefined, images },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

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
