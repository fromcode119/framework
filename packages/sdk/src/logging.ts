export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  namespace?: string;
  minLevel?: LogLevel;
}

const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
const defaultLogLevel = envLogLevel && envLogLevel in LogLevel ? (LogLevel as any)[envLogLevel] : LogLevel.DEBUG;

export class Logger {
  private namespace: string;
  private minLevel: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.namespace = options.namespace || 'system';
    this.minLevel = options.minLevel !== undefined ? options.minLevel : defaultLogLevel;
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.namespace}] ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(this.format('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.minLevel <= LogLevel.INFO) {
      console.log(this.format('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(this.format('WARN', message), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.minLevel <= LogLevel.ERROR) {
      console.error(this.format('ERROR', message), ...args);
    }
  }

  child(namespace: string): Logger {
    return new Logger({
      namespace: `${this.namespace}:${namespace}`,
      minLevel: this.minLevel,
    });
  }
}

export const logger = new Logger();
