import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { ColorSchemeBootScript } from '@/lib/color-scheme-boot-script';
import { MetadataHeadView } from '@/lib/document/metadata-head-view';
import type { ThemeHeadModel } from '@/lib/document/theme-head-model';
import type { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * The `<head>` of the islands document. Same content as the App Router head, as plain elements:
 *
 *  - charset + viewport (Next emitted these itself);
 *  - the pre-paint colour-scheme restore script;
 *  - the page metadata (title, description, canonical, robots, Open Graph, Twitter, icons);
 *  - the theme's contribution (`ThemeHeadModel`): preconnect/preload hints as `<link>`s, declared head
 *    links, theme variables + inlined CSS, prefetch script, entry meta, the modulepreload injector;
 *  - the server-rendered theme's lifted head: plugin default sheets FIRST (they must sit ahead of the
 *    theme's stylesheet — same order the plugin gives them in the browser with `head.prepend`), then the
 *    emotion groups with `data-emotion` VERBATIM so emotion's browser cache adopts them, then the LCP
 *    image preloads;
 *  - plugin head injections;
 *  - the runtime injector: one classic `<script>` appended after `load`, the only JavaScript delivery
 *    this document has.
 */
export class DocumentHeadView {
  static render({ page, site, theme, markup, injections, runtimeScriptPath, layoutStylesheets }: {
    page: Metadata;
    site: Metadata;
    theme: ThemeHeadModel | null;
    markup: ThemeSsrMarkup | null;
    injections: ReactElement[];
    runtimeScriptPath: string;
    layoutStylesheets: string[];
  }): ReactNode {
    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: ColorSchemeBootScript.inlineScript() }} />
        <MetadataHeadView.render page={page} site={site} />
        {layoutStylesheets.map((href) => <link key={href} rel="stylesheet" href={href} />)}
        {theme ? DocumentHeadView.themeHead(theme) : null}
        {markup ? DocumentHeadView.liftedHead(markup) : null}
        {injections}
        {runtimeScriptPath ? <script dangerouslySetInnerHTML={{ __html: DocumentHeadView.runtimeInjector(runtimeScriptPath) }} /> : null}
      </head>
    );
  }

  private static themeHead(theme: ThemeHeadModel): ReactNode {
    return (
      <>
        {theme.apiUrl ? <link rel="preconnect" href={theme.apiUrl} crossOrigin="anonymous" /> : null}
        {theme.preloadLinks.map((link, i) => <link key={`pl-${i}`} {...link.elementProps} as={link.as || 'fetch'} />)}
        {theme.lcpPreload ? (
          <link
            rel="preload"
            as="image"
            href={theme.lcpPreload.href}
            fetchPriority="high"
            {...(theme.lcpPreload.imageSrcSet ? { imageSrcSet: theme.lcpPreload.imageSrcSet } : {})}
            {...(theme.lcpPreload.imageSizes ? { imageSizes: theme.lcpPreload.imageSizes } : {})}
          />
        ) : null}
        {theme.elementLinks.map((link, i) => <link key={`hl-${i}`} {...link.elementProps} />)}
        {theme.fallbackCssHrefs.map((href) => <link key={href} rel="stylesheet" href={href} />)}
        {theme.cssVariables ? <style id="fc-theme-variables" dangerouslySetInnerHTML={{ __html: theme.cssVariables }} /> : null}
        {theme.inlinedCss ? <style data-theme={theme.slug} dangerouslySetInnerHTML={{ __html: theme.inlinedCss }} /> : null}
        {/* The theme's boot script, inlined so it runs at FIRST PAINT rather than behind the bundle
            chain — see `ThemeHeadModel.loadBootScript`. */}
        {theme.inlinedBootScript ? <script dangerouslySetInnerHTML={{ __html: theme.inlinedBootScript }} /> : null}
        {theme.prefetchScript ? <script dangerouslySetInnerHTML={{ __html: theme.prefetchScript }} /> : null}
        {theme.versionedEntryUrl ? <meta name="fromcode:theme-entry" content={theme.versionedEntryUrl} /> : null}
        {/* The theme entry and its chunks, hinted at PARSE time — see `ThemeHeadModel.modulePreloadLinks`
            for why these are no longer created by a script after `load`. */}
        {theme.modulePreloadLinks.map((href) => <link key={href} rel="modulepreload" href={href} crossOrigin="anonymous" />)}
        {theme.injectorScript ? <script dangerouslySetInnerHTML={{ __html: theme.injectorScript }} /> : null}
      </>
    );
  }

  /** Server-generated CSS (emotion from the theme's own style objects, plugin sheets from installed files) — never request input. */
  private static liftedHead(markup: ThemeSsrMarkup): ReactNode {
    return (
      <>
        {markup.pluginStyles.map((style) => (
          <style key={style.href} data-fc-plugin-default={style.key} dangerouslySetInnerHTML={{ __html: style.css }} />
        ))}
        {markup.styleGroups.map((group) => (
          <style key={group.href} data-emotion={group.dataEmotion} dangerouslySetInnerHTML={{ __html: group.css }} />
        ))}
        {markup.imagePreloads.map((href) => (
          <link key={href} rel="preload" as="image" href={href} fetchPriority="high" />
        ))}
      </>
    );
  }

  /**
   * Appends the runtime script after `load` (idle slice, 1.5 s floor) — the same deferral the App
   * Router's `FrontendRuntimeScheduler` applies. A classic script, not a module: the import map is still
   * written by the runtime itself, and a module script would have to run after it.
   */
  private static runtimeInjector(scriptPath: string): string {
    return `(function(){var s=function(){var e=document.createElement('script');e.src=${JSON.stringify(scriptPath)};e.async=true;document.head.appendChild(e);};var d=function(){if(window.requestIdleCallback){window.requestIdleCallback(s,{timeout:1500});}else{setTimeout(s,200);}};if(document.readyState==='complete'){d();}else{addEventListener('load',d,{once:true});}})();`;
  }
}
