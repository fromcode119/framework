import { CoercionUtils } from '@fromcode119/core/client';
import { StorefrontDocumentContract } from '@/lib/document/storefront-document-contract';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';

/**
 * What the document tells the runtime about itself — the JSON in `<script type="application/json"
 * id="fc-runtime-config">`, written by the document renderer (plan Task 4) with the same escaping as
 * the prefetch script.
 *
 * Everything the runtime needs to seed the provider and hydrate the server tree without a round-trip:
 * the API base, the document locale and that locale's server translations, the resolved content and
 * its layout, whether the server body came from a plugin's content slot, the page kind, and the public
 * `/system/frontend` payload the server rendered against. No field is invented here: an absent value
 * stays empty and the runtime decides what that means (usually: the fallback path).
 */
export class FrontendRuntimeConfig {
  static readonly ELEMENT_ID = StorefrontDocumentContract.CONFIG_ELEMENT_ID;

  readonly apiUrl: string;

  readonly locale: string;

  readonly content: Record<string, unknown> | null;

  /** The layout name the route forced (home's `forcedLayout`); empty when the content decides. */
  readonly layoutName: string;

  readonly ssrRendersContentSlot: boolean;

  readonly pageKind: StorefrontPageKind;

  /** For a 404 document: the path that did not resolve (the 404 overrides receive it). */
  readonly notFoundPath: string;

  /** The public `/system/frontend` payload — `activeTheme`, `plugins`, `settings`, `menu`, `runtimeModules`, `cssVariables`. */
  readonly frontend: Record<string, any>;

  /** Idle plugins whose bundle this page never needs (`PluginBundlePolicy`); the loader skips them. */
  readonly skipPlugins: string[];

  /** The document locale's server translations (`/system/i18n?locale=`). */
  readonly translations: Record<string, unknown>;

  private constructor(raw: Record<string, unknown>) {
    this.apiUrl = CoercionUtils.toString(raw.apiUrl);
    this.locale = CoercionUtils.toString(raw.locale);
    this.content = raw.content && typeof raw.content === 'object' ? (raw.content as Record<string, unknown>) : null;
    this.layoutName = CoercionUtils.toString(raw.layoutName);
    this.ssrRendersContentSlot = CoercionUtils.toBoolean(raw.ssrRendersContentSlot) === true;
    this.pageKind = StorefrontPageKind.fromValue(CoercionUtils.toString(raw.pageKind)) ?? StorefrontPageKind.CONTENT;
    this.notFoundPath = CoercionUtils.toString(raw.notFoundPath);
    this.frontend = raw.frontend && typeof raw.frontend === 'object' ? (raw.frontend as Record<string, any>) : {};
    this.translations = raw.translations && typeof raw.translations === 'object' ? (raw.translations as Record<string, unknown>) : {};
    this.skipPlugins = Array.isArray(raw.skipPlugins) ? raw.skipPlugins.map((slug) => CoercionUtils.toString(slug)).filter(Boolean) : [];
  }

  /** The config element's JSON, or null when the document carries none (nothing to hydrate). */
  static fromDocument(doc: Document = document): FrontendRuntimeConfig | null {
    const element = doc.getElementById(FrontendRuntimeConfig.ELEMENT_ID);
    const text = String(element?.textContent || '').trim();
    if (!text) return null;
    try {
      return FrontendRuntimeConfig.fromJson(JSON.parse(text));
    } catch (error) {
      console.error('[frontend] runtime config is not valid JSON:', error);
      return null;
    }
  }

  static fromJson(raw: unknown): FrontendRuntimeConfig {
    return new FrontendRuntimeConfig(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
  }

  get activeTheme(): Record<string, any> | null {
    const theme = this.frontend.activeTheme;
    return theme && typeof theme === 'object' ? (theme as Record<string, any>) : null;
  }

  get plugins(): any[] {
    return Array.isArray(this.frontend.plugins) ? this.frontend.plugins : [];
  }

  /** The theme's declared default layout (theme.json `defaultLayout`); never guessed. */
  get declaredDefaultLayout(): string {
    return CoercionUtils.toString(this.activeTheme?.defaultLayout);
  }

  /** The layout the server rendered with: the content's own, else the route's forced one, else the theme's default. */
  get resolvedLayoutName(): string {
    return ResolvedContentShape.resolveLayoutName(this.content) || this.layoutName || this.declaredDefaultLayout;
  }

  /** `/system/frontend`'s `cssVariables` stylesheet text, which `loadConfig` would otherwise mount. */
  get cssVariables(): string {
    return CoercionUtils.toString(this.frontend.cssVariables);
  }

  get hasRecipe(): boolean {
    return Boolean(this.content?.recipe);
  }
}
