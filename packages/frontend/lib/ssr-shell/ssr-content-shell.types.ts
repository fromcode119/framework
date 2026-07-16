export type SsrShellNavItem = {
  label: string;
  href: string;
};

export type SsrShellModel = {
  /** Site brand text for the shell's minimal top bar (from SEO site settings). */
  siteName: string;
  /** Resolved document title (used as `<h1>` fallback when no hero heading exists). */
  title: string;
  /** Hero heading extracted from the document's first meaningful content block. */
  heading: string;
  /** Hero/intro text extracted from the document's first meaningful content block. */
  text: string;
  /** Top-level navigation items (labels + hrefs) from the theme-declared nav prefetch. */
  navItems: SsrShellNavItem[];
};

export type SsrShellBuildOptions = {
  locale?: string;
  siteName?: string;
  navItems?: SsrShellNavItem[];
};
