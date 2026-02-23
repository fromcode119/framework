import { useCallback, useMemo } from 'react';
import { 
  SYSTEM_SHORTCODES_PATH, 
  SYSTEM_SHORTCODES_RENDER_PATH,
  type RenderShortcodesPayload,
  type RenderShortcodesResponse,
  type ShortcodeCatalogResponse
} from '@fromcode/sdk';
import { usePlugins } from './context';

type ListShortcodesOptions = {
  silent?: boolean;
};

type RenderShortcodesOptions = {
  silent?: boolean;
};

/**
 * Shared shortcode API wrapper so plugins do not hardcode system endpoints.
 */
export function useSystemShortcodes() {
  const { api } = usePlugins();

  const list = useCallback(
    async (options: ListShortcodesOptions = {}): Promise<ShortcodeCatalogResponse> => {
      return api.get(SYSTEM_SHORTCODES_PATH, { silent: options.silent ?? true }) as Promise<ShortcodeCatalogResponse>;
    },
    [api]
  );

  const render = useCallback(
    async (payload: RenderShortcodesPayload, options: RenderShortcodesOptions = {}): Promise<RenderShortcodesResponse> => {
      return api.post(
        SYSTEM_SHORTCODES_RENDER_PATH,
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
