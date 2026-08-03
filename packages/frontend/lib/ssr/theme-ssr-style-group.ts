/**
 * One emotion style bucket lifted out of a server-rendered theme, ready to go into `<head>`.
 *
 * `renderToStaticMarkup` makes emotion emit a `<style data-emotion="…">` right before the first
 * element that needs it, so the styles come back scattered through the body. They are regrouped by
 * emotion KEY (`css`, `css-global`, …) and concatenated — the same shape `@emotion/server` produces —
 * because the `data-emotion` attribute is how the browser cache recognises server-inserted styles and
 * adopts them instead of re-inserting. Splitting or renaming that attribute breaks the adoption.
 */
export class ThemeSsrStyleGroup {
  /** The emotion cache key (`css`), plus its variant suffix for global styles (`css-global`). */
  readonly emotionKey: string;

  /** Space-separated style hashes, in insertion order — the rest of the `data-emotion` attribute. */
  readonly names: string[];

  /** The concatenated CSS text of every tag in this bucket. */
  readonly css: string;

  constructor(emotionKey: string, names: string[], css: string) {
    this.emotionKey = emotionKey;
    this.names = names;
    this.css = css;
  }

  /** The full `data-emotion` attribute value the browser cache parses. */
  get dataEmotion(): string {
    return [this.emotionKey, ...this.names].join(' ');
  }

  /** Stable `href` for React 19 style hoisting — dedupes the tag across re-renders. */
  get href(): string {
    return `fc-theme-ssr-${this.emotionKey}`;
  }

  /** Merge another bucket with the same key into a new group, preserving order. */
  concat(names: string[], css: string): ThemeSsrStyleGroup {
    return new ThemeSsrStyleGroup(this.emotionKey, [...this.names, ...names], this.css + css);
  }
}
