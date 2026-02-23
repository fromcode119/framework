export const SYSTEM_SHORTCODES_PATH = '/system/shortcodes';
export const SYSTEM_SHORTCODES_RENDER_PATH = '/system/shortcodes/render';

export type RenderShortcodesPayload = {
  content: string;
  maxShortcodes?: number;
};

export type RenderShortcodesResponse = {
  rendered?: string;
  shortcodesDetected?: number;
  shortcodesRendered?: number;
  errors?: string[];
};

export type ShortcodeCatalogItem = {
  name?: string;
  description?: string;
};

export type ShortcodeCatalogResponse = {
  docs?: ShortcodeCatalogItem[];
};
