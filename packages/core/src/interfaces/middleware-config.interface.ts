import { MiddlewareStage } from '@core/enums/middleware-stage.enum';

export interface IMiddlewareConfig {
  id: string;
  priority?: number;
  stage: MiddlewareStage;
  handler: (req: any, res: any, next: (err?: any) => void) => void;
  pluginSlug?: string;
}
