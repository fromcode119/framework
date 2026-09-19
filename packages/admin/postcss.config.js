/**
 * Stays JavaScript, unlike every other config here.
 *
 * Next resolves PostCSS through `postcss-load-config`, which reads `.js`, `.cjs`, `.mjs` and `.json`
 * — a `.ts` config needs a TypeScript loader registered before PostCSS runs, and there is nowhere in
 * the Next build to register one. `next.config`, `tailwind.config` and the shared `config/` module
 * are all TypeScript; this one cannot be until that resolver learns the extension.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
