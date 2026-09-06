import { preconnect, preload } from 'react-dom';
import { ThemeHeadModel } from '@/lib/document/theme-head-model';

/**
 * Server Component: injects active theme CSS and head link hints into <head> of the App Router
 * document. All the DATA comes from `ThemeHeadModel` (shared with the islands document's head); this
 * component only issues React's resource hints and renders the elements.
 *
 * Theme JS entry is intentionally NOT injected as a `<link rel="preload">`: React 19 rewrites preload
 * links into :HL directives without `crossOrigin` for scripts, so the bundle downloaded twice (no-CORS
 * preload + CORS `import()`). The entry + its chunks are `modulepreload`ed by the injector script after
 * `load` instead, and imported once by the plugin loader.
 */
export class ThemeAssetsView {
  static async render() {
    try {
      const model = await ThemeHeadModel.load();
      if (!model) return null;

      // Preconnect to the API origin early — reduces DNS+TCP overhead for every asset and endpoint.
      if (model.apiUrl) preconnect(model.apiUrl, { crossOrigin: 'anonymous' });
      for (const link of model.preloadLinks) {
        preload(link.href, {
          as: (link.as || 'fetch') as NonNullable<Parameters<typeof preload>[1]>['as'],
          type: link.type || undefined,
          crossOrigin: link.crossOrigin || undefined,
          fetchPriority: (link.fetchPriority || undefined) as 'high' | 'low' | 'auto' | undefined,
        } as Parameters<typeof preload>[1]);
      }
      if (model.lcpPreload) {
        preload(model.lcpPreload.href, {
          as: 'image',
          fetchPriority: 'high',
          ...(model.lcpPreload.imageSrcSet ? { imageSrcSet: model.lcpPreload.imageSrcSet } : {}),
          ...(model.lcpPreload.imageSizes ? { imageSizes: model.lcpPreload.imageSizes } : {}),
        });
      }

      return (
        <>
          {model.elementLinks.map((link, i) => <link key={`hl-${i}`} {...link.elementProps} />)}
          {model.fallbackCssHrefs.map((href) => <link key={href} rel="stylesheet" href={href} />)}
          {model.cssVariables ? <style id="fc-theme-variables" dangerouslySetInnerHTML={{ __html: model.cssVariables }} /> : null}
          {model.inlinedCss ? <style data-theme={model.slug} dangerouslySetInnerHTML={{ __html: model.inlinedCss }} /> : null}
          {model.prefetchScript ? <script dangerouslySetInnerHTML={{ __html: model.prefetchScript }} /> : null}
          {model.versionedEntryUrl ? <meta name="fromcode:theme-entry" content={model.versionedEntryUrl} /> : null}
          {/* Inline script: modulepreload + non-blocking external stylesheets, so React 19's resource
              hoisting cannot interfere (see ThemeHeadModel.injectorScript). */}
          {model.injectorScript ? <script dangerouslySetInnerHTML={{ __html: model.injectorScript }} /> : null}
        </>
      );
    } catch (error) {
      console.error('[ThemeAssets] Error:', error);
      return null;
    }
  }
}
