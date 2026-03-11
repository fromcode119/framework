// ─── Companion types file for logging.ts ────────────────────────────────────

// LogLevel is moved here because LoggerOptions depends on it.
// The enum has a runtime representation but is treated as a type construct.
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

