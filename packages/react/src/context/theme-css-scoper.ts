/**
 * Confines a storefront theme's stylesheet to the surfaces that render theme components.
 *
 * The admin loads the site's theme so a block preview can render through the theme's overrides,
 * and that needs the theme's CSS. Mounted as a plain `<link>`, the theme's ELEMENT rules restyled
 * the console itself: `h1…h6 { font-family: Cinzel, serif }` turned every block card title on a
 * Bulgarian console into Times (Cinzel has no Cyrillic), and a theme with a `*`/`body`/`button`
 * reset would restyle every control. A stylesheet written for a whole storefront page has no
 * business outside the preview box.
 *
 * The rules are wrapped in `@scope ([data-fc-theme-surface])`, so they only reach elements inside a
 * container carrying that attribute — the block editor's preview, or any admin surface that renders
 * a theme component. Inside the scope:
 *  - `html` / `body` / `:root` at the start of a selector mean the scope root (`:scope`), keeping
 *    the condition they carry (`:root[data-theme=dark] .x` → `:root[data-theme=dark] :scope .x`).
 *  - `@font-face`, `@keyframes`, `@property`, `@counter-style`, `@font-palette-values` and
 *    `@import` cannot live inside `@scope`; they are document-global by nature and stay top level.
 *  - Relative `url()`s are resolved against the stylesheet's own URL, because the text is inlined
 *    into a `<style>` whose base is the document, not the CSS file.
 */
export class ThemeCssScoper {
  static readonly SURFACE_ATTRIBUTE = 'data-fc-theme-surface';

  private static readonly GLOBAL_AT_RULES = /^@(-[a-z]+-)?(font-face|keyframes|property|counter-style|font-palette-values|font-feature-values|import|charset|namespace)\b/i;
  private static readonly GROUPING_AT_RULES = /^@(media|supports|container|layer|document|starting-style)\b/i;
  private static readonly DOCUMENT_ROOT = /^(?::root|html|body)(?=$|[\s>+~.#:[])/i;

  static scope(css: string, stylesheetUrl: string): string {
    const absolute = ThemeCssScoper.absolutizeUrls(css, stylesheetUrl);
    const globals: string[] = [];
    const scoped: string[] = [];
    for (const statement of ThemeCssScoper.split(absolute)) {
      if (ThemeCssScoper.GLOBAL_AT_RULES.test(statement.prelude)) globals.push(statement.text);
      else scoped.push(ThemeCssScoper.rewrite(statement));
    }
    return `${globals.join('\n')}\n@scope ([${ThemeCssScoper.SURFACE_ATTRIBUTE}]) {\n${scoped.join('\n')}\n}\n`;
  }

  private static rewrite(statement: { prelude: string; body: string | null; text: string }): string {
    if (statement.body === null) return statement.text;
    if (statement.prelude.startsWith('@')) {
      if (!ThemeCssScoper.GROUPING_AT_RULES.test(statement.prelude)) return statement.text;
      const inner = ThemeCssScoper.split(statement.body).map((child) => ThemeCssScoper.rewrite(child)).join('\n');
      return `${statement.prelude} {\n${inner}\n}`;
    }
    const selectors = ThemeCssScoper.splitTopLevel(statement.prelude, ',').map((selector) => ThemeCssScoper.rewriteSelector(selector.trim()));
    return `${selectors.join(', ')} {${statement.body}}`;
  }

  private static rewriteSelector(selector: string): string {
    const match = ThemeCssScoper.DOCUMENT_ROOT.exec(selector);
    if (!match) return selector;
    // The leading compound (`:root[...]`, `html.dark`, `body`) runs up to the first combinator.
    const compoundEnd = ThemeCssScoper.compoundEnd(selector);
    const compound = selector.slice(0, compoundEnd);
    const rest = selector.slice(compoundEnd);
    const condition = compound.slice(match[0].length);
    // A condition on the document root (`:root[data-theme=dark]`, `html.dark`) still holds outside
    // the scope, so it is kept as an ancestor of `:scope`. `body` carries none the admin shares.
    const isDocumentElement = /^(?::root|html)$/i.test(match[0]);
    return condition && isDocumentElement ? `:root${condition} :scope${rest}` : `:scope${rest}`;
  }

  private static compoundEnd(selector: string): number {
    let depth = 0;
    for (let index = 0; index < selector.length; index += 1) {
      const char = selector[index];
      if (char === '(' || char === '[') depth += 1;
      else if (char === ')' || char === ']') depth -= 1;
      else if (depth === 0 && /[\s>+~]/.test(char)) return index;
    }
    return selector.length;
  }

  private static absolutizeUrls(css: string, stylesheetUrl: string): string {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote: string, target: string) => {
      if (/^(data:|blob:|https?:|\/\/|#)/i.test(target)) return whole;
      try {
        return `url(${quote}${new URL(target, stylesheetUrl).href}${quote})`;
      } catch {
        return whole;
      }
    });
  }

  /** Top-level statements: `prelude { body }` blocks and `@rule …;` statements, comments dropped. */
  private static split(css: string): Array<{ prelude: string; body: string | null; text: string }> {
    const statements: Array<{ prelude: string; body: string | null; text: string }> = [];
    let start = 0;
    let depth = 0;
    let bodyStart = -1;
    let quote = '';
    for (let index = 0; index < css.length; index += 1) {
      const char = css[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '/' && css[index + 1] === '*') {
        const close = css.indexOf('*/', index + 2);
        const end = close === -1 ? css.length : close + 2;
        if (depth === 0) {
          css = css.slice(0, index) + ' '.repeat(end - index) + css.slice(end);
        }
        index = end - 1;
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '{') {
        if (depth === 0) bodyStart = index;
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          statements.push({ prelude: css.slice(start, bodyStart).trim(), body: css.slice(bodyStart + 1, index), text: css.slice(start, index + 1).trim() });
          start = index + 1;
        }
      } else if (char === ';' && depth === 0) {
        const text = css.slice(start, index + 1).trim();
        if (text) statements.push({ prelude: text, body: null, text });
        start = index + 1;
      }
    }
    return statements.filter((statement) => statement.text.length > 0);
  }

  private static splitTopLevel(value: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let from = 0;
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (char === '(' || char === '[') depth += 1;
      else if (char === ')' || char === ']') depth -= 1;
      else if (char === separator && depth === 0) {
        parts.push(value.slice(from, index));
        from = index + 1;
      }
    }
    parts.push(value.slice(from));
    return parts;
  }
}
