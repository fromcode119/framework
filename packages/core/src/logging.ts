import { LogLevel } from '@core/enums/log-level.enum';
import type { ILoggerOptions } from '@core/interfaces/logger-options.interface';

export class Logger {
  /** `LOG_LEVEL` from the environment, or DEBUG. `resolve()` replaces an `in LogLevel` + cast probe. */
  private static readonly defaultLogLevel = LogLevel.resolve(process.env.LOG_LEVEL);

  private namespace: string;
  private minLevel: LogLevel;

  constructor(options: ILoggerOptions = {}) {
    this.namespace = options.namespace || 'system';
    this.minLevel = options.minLevel !== undefined ? options.minLevel : Logger.defaultLogLevel;
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.namespace}] ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.minLevel.permits(LogLevel.DEBUG)) {
      console.debug(this.format('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.minLevel.permits(LogLevel.INFO)) {
      console.log(this.format('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.minLevel.permits(LogLevel.WARN)) {
      console.warn(this.format('WARN', message), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.minLevel.permits(LogLevel.ERROR)) {
      console.error(this.format('ERROR', message), ...args);
    }
  }

  child(namespace: string): Logger {
    return new Logger({
      namespace: `${this.namespace}:${namespace}`,
      minLevel: this.minLevel,
    });
  }

  /** Flatten a message plus its extra args into ONE string, for log sinks that accept only a single string
   *  (e.g. a DB log writer). Console-based methods above take varargs natively and don't need this. */
  static renderLine(message: string, meta: unknown[]): string {
    if (!meta.length) return message;
    const rendered = meta.map((m) => {
      if (typeof m === 'string') return m;
      try { return JSON.stringify(m); } catch { return String(m); }
    }).join(' ');
    return `${message} ${rendered}`;
  }
}