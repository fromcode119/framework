import type { ITranslationContextValue } from '@react/context/interfaces/translation-context-value.interface';

/**
 * Capabilities handed to a stat contributor's `loadStats` by the overview panel: the cross-plugin
 * namespace facade (so a plugin resolves ITS OWN client), the API client surface, and the active
 * translation function. Contributors never receive framework internals beyond these.
 */
export interface IAccountOverviewStatContext {
  namespace: (namespace: string) => any;
  api: any;
  t: ITranslationContextValue['t'];
}
