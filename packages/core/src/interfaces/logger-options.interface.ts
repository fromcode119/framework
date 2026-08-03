import { LogLevel } from '@core/enums/log-level.enum';

export interface ILoggerOptions {
  namespace?: string;
  minLevel?: LogLevel;
}
