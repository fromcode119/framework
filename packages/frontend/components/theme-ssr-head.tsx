import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * Server Component: the `<head>` half of a server-rendered theme.
 *
 * React 19 hoists `<link rel="preload">` and `<style href precedence>` out of wherever they are
 * rendered and into the document head, so this can live in the page body's tree and still land in
 * head — ahead of first paint, and outside the body markup that gets replaced when the theme's
 * browser bundle takes over rendering.
 *
 * The `data-emotion` attribute is reproduced verbatim: emotion's browser cache looks for exactly that
 * attribute to recognise server-inserted styles and adopt them instead of re-inserting every rule.
 *
 * The CSS is not user content and is never sanitized: emotion produced it from the theme's own style
 * objects during `ThemeServerRenderer`'s render, in this process, and the plugin default sheets are
 * files shipped inside the installed plugins. Nothing from the request reaches either.
 */
export class ThemeSsrHeadView {
  static render({ markup }: { markup: ThemeSsrMarkup }) {
    return (
      <>
        {markup.imagePreloads.map((href) => (
          <link key={href} rel="preload" as="image" href={href} fetchPriority="high" />
        ))}
        {/*
          * FIRST, and before the emotion groups: React orders precedences by first registration, so
          * these land at the top of <head> — ahead of the theme's own stylesheet, which is where the
          * plugin puts them in the browser (`head.prepend`). A theme's single-class brand rule then
          * wins the cascade tie on load order, both server-side and after hydration.
          */}
        {markup.pluginStyles.map((style) => (
          <style
            key={style.href}
            href={style.href}
            precedence="fc-plugin-default"
            data-fc-plugin-default={style.key}
            {...ThemeSsrHeadView.inlineCss(style.css)}
          />
        ))}
        {markup.styleGroups.map((group) => (
          <style
            key={group.href}
            href={group.href}
            precedence="fc-theme-ssr"
            data-emotion={group.dataEmotion}
            {...ThemeSsrHeadView.inlineCss(group.css)}
          />
        ))}
      </>
    );
  }

  /** Emotion CSS is trusted, server-generated output — see the note on this class. */
  private static inlineCss(css: string): Record<string, unknown> {
    return { dangerouslySetInnerHTML: { __html: css } };
  }
}
