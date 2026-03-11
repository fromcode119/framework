import { LogLevel } from './logging.enums';

export interface LoggerOptions {
  namespace?: string;
  minLevel?: LogLevel;
}
