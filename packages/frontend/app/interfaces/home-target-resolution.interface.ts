import type { IResolvedDocResult } from '@/lib/interfaces/resolved-doc-result.interface';

/** The home route's resolved render target: page content, an optional forced layout, and the source doc. */
export interface IHomeTargetResolution {
  content: unknown;
  forcedLayout: string | null;
  resolution: IResolvedDocResult | null;
}
