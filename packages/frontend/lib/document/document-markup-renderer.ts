import { createRequire } from 'node:module';

/**
 * `react-dom/server` for the islands document, resolved through `createRequire` exactly as
 * `ThemeSsrRuntime` resolves it: Next refuses a static `react-dom/server` import anywhere in an App
 * Router module graph ("render as a Server Component instead"), and a Server Component cannot return a
 * raw HTML `Response`. The document IS a Response — one static string — so it is rendered here, by the
 * same React the theme's server bundle renders with, outside Next's rendering pipeline.
 */
export class DocumentMarkupRenderer {
  private static react: { createElement: (type: unknown, props: unknown) => unknown; renderToStaticMarkup: (element: unknown) => string } | null = null;

  /** Renders `component` (a static view function) with `props` to static HTML — element and renderer from the ONE React. */
  static render(component: unknown, props: Record<string, unknown>): string {
    if (!DocumentMarkupRenderer.react) {
      const appRequire = createRequire(`${process.cwd()}/`);
      const react = appRequire('react') as { createElement: (type: unknown, props: unknown) => unknown };
      const reactDomServer = appRequire('react-dom/server') as { renderToStaticMarkup: (element: unknown) => string };
      DocumentMarkupRenderer.react = { createElement: react.createElement, renderToStaticMarkup: reactDomServer.renderToStaticMarkup };
    }
    return DocumentMarkupRenderer.react.renderToStaticMarkup(DocumentMarkupRenderer.react.createElement(component, props));
  }
}
