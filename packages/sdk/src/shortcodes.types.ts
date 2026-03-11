/** Type definitions for ShortcodeUtils */

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
