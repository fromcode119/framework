import { useCallback, useMemo } from 'react';
import { 
  ShortcodeUtils,
  type RenderShortcodesPayload,
  type RenderShortcodesResponse,
  type ShortcodeCatalogResponse
} from '@fromcode119/sdk';
import { ContextHooks } from './context-hooks';
import type { ListShortcodesOptions, RenderShortcodesOptions } from './system-shortcodes.types';

/**
 * Shared shortcode API wrapper so plugins do not hardcode system endpoints.
 */
export class SystemShortcodes {
  static useSystemShortcodes() {
    const { api } = ContextHooks.usePlugins();

    const list = useCallback(
      async (options: ListShortcodesOptions = {}): Promise<ShortcodeCatalogResponse> => {
        return api.get(ShortcodeUtils.SYSTEM_SHORTCODES_PATH, { silent: options.silent ?? true }) as Promise<ShortcodeCatalogResponse>;
      },
      [api]
    );

    const render = useCallback(
      async (payload: RenderShortcodesPayload, options: RenderShortcodesOptions = {}): Promise<RenderShortcodesResponse> => {
        return api.post(
          ShortcodeUtils.SYSTEM_SHORTCODES_RENDER_PATH,
          payload,
          { silent: options.silent ?? true }
        ) as Promise<RenderShortcodesResponse>;
      },
      [api]
    );

    return useMemo(
      () => ({
        list,
        render
      }),
      [list, render]
    );
  }
}
