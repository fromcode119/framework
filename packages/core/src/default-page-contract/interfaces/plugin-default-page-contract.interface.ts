import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

export interface IPluginDefaultPageContract {
  key: string;
  kind: PluginDefaultPageContractKind;
  defaultSlug: string;
  recordCollection?: string;
  capability: string;
  recipe: string;
  title?: string;
  /**
   * A key in the owning plugin's translations for the page title, looked up in the SITE's language
   * (Settings → Localization) when the page is created there. Contracts are declared once at boot,
   * before any site is known, so a `title` computed then is in the platform's language — a Bulgarian
   * site got "Confirm your subscription". `title` stays the text used when the key has no translation.
   * A theme override's title still wins over both.
   */
  titleKey?: string;
  themeLayout?: string;
  styleVariant?: string;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  dependencies: PluginDefaultPageContractDependency[];
  adoptionHints: string[];
  required: boolean;
  /**
   * A boolean setting of the owning plugin that switches this page on per site. When set, the page is
   * materialized only on sites whose stored value of that setting is `true` — a feature a site opts
   * into brings its page with it, and a site that never turns it on gets no page. Unset: the contract
   * installs wherever the plugin runs, as before.
   */
  enabledBySetting?: string;
  aliases?: string[];
  /**
   * Optional default block content the materializer writes when creating this page (instead
   * of an empty `[]`). Lets a plugin own its route AND its default block (e.g. an affiliate
   * portal block), so the theme only OVERRIDES the block renderer for branding — no theme/seed
   * needed to place the block.
   */
  defaultContent?: any[];
  /**
   * The owning plugin's public-API method that answers this site's values for the `{{name}}`
   * placeholders in `defaultContent` — e.g. the company a site trades as. Called once, inside the site,
   * when the page is created; `{{siteName}}` and `{{siteHost}}` are the framework's own and need no
   * method. A placeholder with no value is left empty, never filled with another site's words.
   */
  contentValues?: string;
}
