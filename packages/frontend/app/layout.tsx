import "@/app/globals.css";
import "@/app/auth.css";
// The framework-owned AccountShell stylesheet. Imported HERE rather than inside `account-shell.tsx`:
// a runtime CSS import in that module compiles to a `require()` in `packages/react/dist`, which makes
// the package unimportable by Node and blocks server-rendering a theme.
import "@fromcode119/react/account/account-shell.css";
import type { Metadata } from 'next';
import { StorefrontRuntimeGate } from "@/app/components/view/storefront-runtime-gate.client";
import { ThemeAssetsView } from '@/components/theme-assets';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { PluginInjectionRenderer } from '@/lib/plugin-injection-renderer';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { ColorSchemeBootScript } from '@/lib/color-scheme-boot-script';

export class FrontendRootLayoutRoute {
  static async generateMetadata(): Promise<Metadata> {
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

  static async render({ children }: Readonly<{ children: React.ReactNode }>) {

    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    const [headElements, bodyStartElements, documentLocale] = await Promise.all([
      PluginInjectionRenderer.loadHeadElements(),
      PluginInjectionRenderer.loadBodyStartElements(),
      FrontendLocaleService.resolveDocumentLocale(routingConfig.strategy),
    ]);
    return (
      <html lang={documentLocale} suppressHydrationWarning>
        <head>
          {/* Pre-paint color-scheme restore (generic, theme-agnostic contract) — see
              `ColorSchemeBootScript`. Serialized from real TypeScript, with the shared
              contract keys supplied from ClientRuntimeConstants; no request/user data
              is interpolated. Must stay synchronous and ahead of any paint. */}
          <script dangerouslySetInnerHTML={{ __html: ColorSchemeBootScript.inlineScript() }} />
          <ThemeAssetsView.render />
          {headElements}
        </head>
        <body>
          {bodyStartElements}
          {/* The plugin runtime (provider stack + loader) is code-split behind this gate and arrives
              AFTER the paint — see StorefrontRuntimeGate. It renders `children` untouched until then,
              which is exactly what the server renders, so hydration matches. */}
          <StorefrontRuntimeGate>{children}</StorefrontRuntimeGate>
        </body>
      </html>
    );
  }
}
