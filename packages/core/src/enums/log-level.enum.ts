import { Enum } from '@fromcode119/reactor';

/**
 * Logger verbosity, ordered least-to-most severe.
 *
 * A reactor `Enum` rather than the numeric TS enum it replaced, so `severity` carries the ordering
 * explicitly: a member is a singleton object, and `<=` on objects is meaningless, so every threshold
 * comparison goes through `.severity` (or `permits()`). The label is `.value` and is what appears in a
 * log line and in `LOG_LEVEL`.
 */
export class LogLevel extends Enum {
  static readonly DEBUG = new LogLevel('DEBUG', 0);
  static readonly INFO = new LogLevel('INFO', 1);
  static readonly WARN = new LogLevel('WARN', 2);
  static readonly ERROR = new LogLevel('ERROR', 3);

  private constructor(value: string, readonly severity: number) {
    super(value);
  }

  /** True when a logger whose minimum is `this` should emit a message at `level`. */
  permits(level: LogLevel): boolean {
    return this.severity <= level.severity;
  }

  /** Resolve a raw `LOG_LEVEL` value (any case) to a member; anything unknown means DEBUG (most verbose). */
  static resolve(value: unknown): LogLevel {
    if (value instanceof LogLevel) return value;
    const found = LogLevel.fromValue(String(value ?? '').trim().toUpperCase());
    return (found as LogLevel | undefined) ?? LogLevel.DEBUG;
  }
}
