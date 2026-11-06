import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';

/**
 * A render request as it crosses into the host: `config` and `serverTranslations` — together a few
 * hundred KB, and the same for every page of a site until it changes — travel once per host process
 * and are referred to by fingerprint afterwards (`refs`). A value is present only when the host has
 * not been sent that fingerprint yet.
 */
export interface IThemeRenderWireRequest extends Omit<IThemeRenderRequest, 'config' | 'serverTranslations'> {
  refs: { config: string; serverTranslations: string };
  config?: Record<string, unknown>;
  serverTranslations?: Record<string, unknown>;
}
