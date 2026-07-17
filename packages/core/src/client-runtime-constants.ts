export class ClientRuntimeConstants {
  static readonly PREFIX = 'fc' as const;
  static readonly STORAGE_PREFIX = `${ClientRuntimeConstants.PREFIX}_`;
  static readonly EVENT_PREFIX = `${ClientRuntimeConstants.PREFIX}:`;
  /** DOM-facing prefix (`fc-`): element ids, class names and the attribute prefix below. */
  static readonly DOM_PREFIX = `${ClientRuntimeConstants.PREFIX}-`;
  static readonly ATTRIBUTE_PREFIX = `data-${ClientRuntimeConstants.DOM_PREFIX}`;

  static readonly COOKIES = {
    AUTH_TOKEN: `${ClientRuntimeConstants.STORAGE_PREFIX}token`,
    AUTH_CSRF: `${ClientRuntimeConstants.STORAGE_PREFIX}csrf`,
    AUTH_USER: `${ClientRuntimeConstants.STORAGE_PREFIX}user`,
    LOCALE: `${ClientRuntimeConstants.STORAGE_PREFIX}locale`,
  } as const;

  static readonly ADMIN_UI = {
    EVENTS: {
      MODE_CHANGED: `${ClientRuntimeConstants.EVENT_PREFIX}admin-mode-change`,
    },
    STORAGE_KEYS: {
      ADVANCED_MODE: `${ClientRuntimeConstants.STORAGE_PREFIX}admin_advanced_mode`,
      SIDEBAR_OPEN: `${ClientRuntimeConstants.STORAGE_PREFIX}sidebar_open`,
      SIDEBAR_MINI: `${ClientRuntimeConstants.STORAGE_PREFIX}sidebar_mini`,
      COLLAPSED_GROUPS: `${ClientRuntimeConstants.STORAGE_PREFIX}sidebar_collapsed_groups`,
      ADMIN_APPEARANCE: `${ClientRuntimeConstants.STORAGE_PREFIX}admin_appearance`,
    },
    STORAGE_PREFIXES: {
      NAV_EXPANDED: `${ClientRuntimeConstants.STORAGE_PREFIX}nav_expanded_`,
      COLLECTION_COLUMNS: `${ClientRuntimeConstants.STORAGE_PREFIX}columns_`,
    },
  } as const;

  static readonly FRONTEND = {
    EVENTS: {
      LIVE_BLOCKS_CHANGED: `${ClientRuntimeConstants.EVENT_PREFIX}live-blocks`,
      PUBLIC_SETTINGS_LOADED: `${ClientRuntimeConstants.EVENT_PREFIX}public-settings-loaded`,
    },
    GLOBAL_KEYS: {
      LIVE_BLOCKS: '__fromcodeLiveBlocks',
    },
    STORAGE_KEYS: {
      /**
       * Persisted light/dark scheme. Written by whichever layer owns the toggle
       * (the theme); read PRE-PAINT by the framework's root-layout boot script.
       */
      COLOR_SCHEME: `${ClientRuntimeConstants.DOM_PREFIX}color-scheme`,
    },
    ATTRIBUTES: {
      /** `<html>` attribute mirroring COLOR_SCHEME — palette CSS keys off it. */
      COLOR_SCHEME: `${ClientRuntimeConstants.ATTRIBUTE_PREFIX}color-scheme`,
      /** `<html>` flag the theme sets on its first real paint; hides the SSR shell. */
      THEME_LIVE: `${ClientRuntimeConstants.ATTRIBUTE_PREFIX}theme-live`,
    },
    /**
     * Server-rendered above-the-fold shell contract, shared by framework TS,
     * `app/globals.css`, and theme CSS/TS. THIS is the source of truth for the
     * names; the CSS files repeat them as literals because CSS cannot import TS.
     */
    SSR_SHELL: {
      ELEMENT_ID: `${ClientRuntimeConstants.DOM_PREFIX}ssr-shell`,
      CLASS_PREFIX: `${ClientRuntimeConstants.DOM_PREFIX}ssr-shell-`,
      /** Diagnostic attribute on the shell root: `theme` (theme template) or absent. */
      KIND_ATTRIBUTE: `${ClientRuntimeConstants.ATTRIBUTE_PREFIX}shell`,
    },
  } as const;
}
