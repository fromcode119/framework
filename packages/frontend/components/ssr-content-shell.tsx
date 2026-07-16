import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { ThemePrefetchRequestCache } from '@/lib/theme/theme-prefetch-request-cache';
import { SsrContentShellService } from '@/lib/ssr-shell/ssr-content-shell-service';
import type { ThemePrefetchApiEntry } from '@/lib/theme/theme-data-prefetcher.interfaces';

/**
 * Server Component: paints a minimal, generic above-the-fold shell (`#fc-ssr-shell`)
 * — main nav + `<h1>` + intro text — from data the server already fetched (the resolved
 * page document and the theme's `ui.prefetchApis` payloads via the shared per-request
 * `ThemePrefetchRequestCache`).
 *
 * Why it is hydration-safe: this component renders as STATIC RSC output, a sibling
 * placed before `DynamicContentClient` in the server page. No client component ever
 * re-renders it, so server HTML and the RSC payload are identical by construction.
 * The theme signals its first real paint by setting `data-fc-theme-live` on <html>
 * (see `app/globals.css`), which hides the shell via CSS — the DOM node itself is
 * never removed, so React's hydrated tree stays intact. If the theme never boots,
 * the shell stays visible: real content instead of a blank page.
 *
 * Styling lives in `app/globals.css` (`#fc-ssr-shell` rules — light/dark aware),
 * which is already a render-blocking first-party stylesheet, so the shell is styled
 * at first paint with no extra request.
 *
 * Opt-out without rebuild: `SSR_CONTENT_SHELL=false`.
 */
export default async function SsrContentShell({ content, locale }: { content: unknown; locale?: string }) {
  if (!SsrContentShellService.isEnabled()) {
    return null;
  }

  try {
    const [config, prefetchData, seo] = await Promise.all([
      FrontendConfigCache.read() as Promise<Record<string, any> | null>,
      ThemePrefetchRequestCache.read(),
      ResolvedContentMetadata.fetchSite(),
    ]);

    const apis = Array.isArray(config?.activeTheme?.ui?.prefetchApis)
      ? (config?.activeTheme?.ui?.prefetchApis as ThemePrefetchApiEntry[])
      : [];
    const model = SsrContentShellService.build(content, {
      locale,
      siteName: seo?.siteName || seo?.title || '',
      navItems: SsrContentShellService.extractNavItems(prefetchData, apis),
    });

    if (!SsrContentShellService.hasRenderableShell(model)) {
      return null;
    }

    const heading = model.heading || model.title;

    return (
      <div id="fc-ssr-shell">
        {(model.siteName || model.navItems.length > 0) ? (
          <header className="fc-ssr-shell-bar">
            {model.siteName ? <span className="fc-ssr-shell-brand">{model.siteName}</span> : null}
            {model.navItems.length > 0 ? (
              <nav aria-label="Main" className="fc-ssr-shell-nav">
                <ul>
                  {model.navItems.map((item, index) => (
                    <li key={`${item.href}-${index}`}>
                      <a href={item.href}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </header>
        ) : null}
        <main className="fc-ssr-shell-main">
          {heading ? <h1>{heading}</h1> : null}
          {model.text ? <p>{model.text}</p> : null}
        </main>
      </div>
    );
  } catch (error) {
    // Non-critical paint placeholder — never let it break the page render.
    console.error('[SsrContentShell] Error:', error);
    return null;
  }
}
