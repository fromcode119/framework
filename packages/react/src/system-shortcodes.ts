import { useCallback, useMemo } from 'react';
import { ShortcodeUtils, type IRenderShortcodesPayload, type IRenderShortcodesResponse, type IShortcodeCatalogResponse } from '@fromcode119/core/client';
import { ContextHooks } from '@react/context-hooks/context-hooks';
import type { IListShortcodesOptions } from '@react/interfaces/list-shortcodes-options.interface';
import type { IRenderShortcodesOptions } from '@react/interfaces/render-shortcodes-options.interface';

/**
 * Shared shortcode API wrapper so plugins do not hardcode system endpoints.
 */
export class SystemShortcodes {
  static useSystemShortcodes() {
    const { api } = ContextHooks.usePlugins();

    const list = useCallback(
      async (options: IListShortcodesOptions = {}): Promise<IShortcodeCatalogResponse> => {
        return api.get(ShortcodeUtils.SYSTEM_SHORTCODES_PATH, { silent: options.silent ?? true }) as Promise<IShortcodeCatalogResponse>;
      },
      [api]
    );

    const render = useCallback(
      async (payload: IRenderShortcodesPayload, options: IRenderShortcodesOptions = {}): Promise<IRenderShortcodesResponse> => {
        return api.post(
          ShortcodeUtils.SYSTEM_SHORTCODES_RENDER_PATH,
          payload,
          { silent: options.silent ?? true }
        ) as Promise<IRenderShortcodesResponse>;
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
