import { Logger } from '@fromcode119/core';

/**
 * Process-level backstop for failures that escaped every handler.
 *
 * This is NOT the fix — {@link AsyncRouteGuard} is. It exists because the old failure mode was silent:
 * Node's default action for an unobserved rejection is to print a bare stack and exit, so the API
 * container simply restarted and nothing said "a promise rejected and nobody caught it". An operator
 * saw an uptime counter reset, days later, if at all.
 *
 * - `unhandledRejection`: log loudly and KEEP RUNNING. A rejection that got this far is a bug to fix,
 *   not a reason to drop every in-flight request of every other tenant.
 * - `uncaughtException`: the process state is no longer trustworthy, so it does exit — but it says why
 *   first, which is the part that was missing.
 */
export class ProcessSafetyNet {
  private static installed = false;
  private static readonly logger = new Logger({ namespace: 'ProcessSafetyNet' });

  static install(): void {
    if (ProcessSafetyNet.installed) {
      return;
    }
    ProcessSafetyNet.installed = true;

    process.on('unhandledRejection', (reason: unknown) => {
      ProcessSafetyNet.logger.error(
        `UNHANDLED PROMISE REJECTION — the process is STAYING UP; this is a bug that must be fixed: ${ProcessSafetyNet.describe(reason)}`,
        { stack: ProcessSafetyNet.stackOf(reason) }
      );
    });

    process.on('uncaughtException', (error: Error) => {
      ProcessSafetyNet.logger.error(
        `UNCAUGHT EXCEPTION — process state is unrecoverable, exiting(1): ${ProcessSafetyNet.describe(error)}`,
        { stack: ProcessSafetyNet.stackOf(error) }
      );
      process.exit(1);
    });
  }

  private static describe(value: unknown): string {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }
    return String(value);
  }

  private static stackOf(value: unknown): string {
    return value instanceof Error ? String(value.stack || '') : '';
  }
}
