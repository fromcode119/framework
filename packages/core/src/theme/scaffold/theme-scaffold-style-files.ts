/**
 * The stylesheets and the translation files. The tokens give the theme's settings (colours, fonts) design
 * names; the base sets the ground and the content widths. Translation files start empty: a theme adds the
 * words its own components show.
 */
export class ThemeScaffoldStyleFiles {
  /** Path (inside the theme) to file content, for a theme called `slug`. */
  static files(slug: string): Record<string, string> {
    return {
      'src/styles/tokens.css': `/*
 * The theme's design tokens. Every colour, font and size the operator can change arrives as a
 * \`--theme-*\` variable from theme.json (Themes → your theme); this file only gives them design names and
 * derives the tints. Nothing here is a second copy of a setting.
 */
:root {
  --${slug}-bg: var(--theme-background-color);
  --${slug}-surface: var(--theme-surface-color);
  --${slug}-text: var(--theme-text-color);
  --${slug}-primary: var(--theme-primary-color);
  --${slug}-accent: var(--theme-accent-color);
  --${slug}-on-primary: var(--theme-background-color);
  --${slug}-heading-font: var(--theme-heading-font);
  --${slug}-body-font: var(--theme-body-font);

  --${slug}-muted: color-mix(in srgb, var(--${slug}-text) 62%, var(--${slug}-bg));
  --${slug}-line: color-mix(in srgb, var(--${slug}-text) 14%, var(--${slug}-bg));
  --${slug}-radius: 8px;
  --${slug}-gutter: 1rem;
  --${slug}-max: 72rem;
}
`,
      'src/styles/base.css': `/* Page ground, type and the content widths. */
.${slug}-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--${slug}-bg);
  color: var(--${slug}-text);
  font-family: var(--${slug}-body-font), system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.${slug}-page *,
.${slug}-page *::before,
.${slug}-page *::after { box-sizing: border-box; }

.${slug}-page h1,
.${slug}-page h2,
.${slug}-page h3,
.${slug}-page h4 {
  font-family: var(--${slug}-heading-font), system-ui, -apple-system, 'Segoe UI', sans-serif;
  line-height: 1.2;
  color: var(--${slug}-text);
}

.${slug}-page a { color: var(--${slug}-primary); }
.${slug}-page a:hover { text-decoration: none; }
.${slug}-page img { max-width: 100%; height: auto; }

.${slug}-page :focus-visible {
  outline: 2px solid var(--${slug}-accent);
  outline-offset: 2px;
}

.${slug}-container {
  width: 100%;
  max-width: var(--${slug}-max);
  margin-inline: auto;
  padding-inline: var(--${slug}-gutter);
}

/* The page body: reading width on a standard page, full-bleed sections on a wide one. */
.${slug}-main { flex: 1 0 auto; }
.${slug}-main:not(.${slug}-main--wide) {
  width: 100%;
  max-width: var(--${slug}-max);
  margin-inline: auto;
  padding: 2rem var(--${slug}-gutter) 3rem;
}
.${slug}-main--wide { padding: 0; }

.${slug}-unsubscribe { max-width: 40rem; margin: 2rem auto; padding-inline: var(--${slug}-gutter); }

@media (prefers-reduced-motion: reduce) {
  .${slug}-page * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`,
      'src/i18n/en.json': `{}
`,
      'src/i18n/bg.json': `{}
`,
    };
  }
}
