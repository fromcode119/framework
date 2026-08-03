import type { Plugin } from 'vite';

/**
 * A plugin's `import styles from './x.css'` yields the CSS as a STRING, which the plugin injects itself
 * — the convention inherited from the old esbuild `--loader:.css=text`. Rewrites `.css` imports to
 * Vite's built-in `?raw` instead of letting Vite treat them as CSS modules.
 *
 * Shared by the client and SSR plugin-UI configs: without it the server build dies on the first such
 * import (`"default" is not exported by …checkout-flow-default.css`), and a plugin whose storefront code
 * imports a stylesheet would silently have no server bundle.
 */
export class PluginUiCssAsTextPlugin {
  static create(): Plugin {
    return {
      name: 'fromcode-css-as-text',
      enforce: 'pre',
      transform(code: string, id: string) {
        const file = id.split('?')[0];
        if (!/\.[jt]sx?$/.test(file) || !code.includes('.css')) return null;
        const out = code.replace(/(from\s+['"])([^'"]+\.css)(['"])/g, '$1$2?raw$3');
        return out === code ? null : out;
      },
    } as Plugin;
  }
}
