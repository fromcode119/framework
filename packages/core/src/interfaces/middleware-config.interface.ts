import { MiddlewareStage } from '@core/enums/middleware-stage.enum';

export interface IMiddlewareConfig {
  id: string;
  priority?: number;
  stage: MiddlewareStage;
  handler: (req: any, res: any, next: (err?: any) => void) => void;
  pluginSlug?: string;
  /**
   * Run only for requests whose path contains one of these fragments (`'/collections/ledger-wallets'`).
   * A middleware that guards a few routes should say so: without it, it runs for EVERY api request —
   * for a plugin in its own process, one extra round trip to that process on each of them.
   */
  pathIncludes?: string[];
}
