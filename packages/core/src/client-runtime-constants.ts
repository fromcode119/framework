export class ClientRuntimeConstants {
  static readonly PREFIX = 'fc' as const;
  static readonly STORAGE_PREFIX = `${ClientRuntimeConstants.PREFIX}_`;
  static readonly EVENT_PREFIX = `${ClientRuntimeConstants.PREFIX}:`;

  static readonly COOKIES = {
    AUTH_TOKEN: `${ClientRuntimeConstants.STORAGE_PREFIX}token`,
    AUTH_CSRF: `${ClientRuntimeConstants.STORAGE_PREFIX}csrf`,
    AUTH_USER: `${ClientRuntimeConstants.STORAGE_PREFIX}user`,
    LOCALE: `${ClientRuntimeConstants.STORAGE_PREFIX}locale`,
    LEGACY_AUTH_TOKENS: [
      `${ClientRuntimeConstants.STORAGE_PREFIX}token_v1`,
      `${ClientRuntimeConstants.STORAGE_PREFIX}token_v2`,
    ],
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
    },
    STORAGE_PREFIXES: {
      NAV_EXPANDED: `${ClientRuntimeConstants.STORAGE_PREFIX}nav_expanded_`,
      COLLECTION_COLUMNS: `${ClientRuntimeConstants.STORAGE_PREFIX}columns_`,
    },
  } as const;
}
