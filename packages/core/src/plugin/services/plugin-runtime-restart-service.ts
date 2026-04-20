import { Logger } from '../../logging';

export class PluginRuntimeRestartService {
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly restartDelayMs: number = 2500,
  ) {}

  scheduleRestart(reason: string): void {
    if (this.restartTimer) {
      this.logger.warn(`Plugin runtime restart already scheduled. Latest reason: ${reason}`);
      return;
    }

    this.logger.warn(`Scheduling process restart in ${this.restartDelayMs}ms: ${reason}`);

    if (process.env.NODE_ENV === 'test' || process.env.FROMCODE_DISABLE_PLUGIN_RUNTIME_RESTART === 'true') {
      return;
    }

    this.restartTimer = setTimeout(() => {
      this.logger.warn(`Restarting process to apply plugin runtime changes: ${reason}`);
      process.exit(0);
    }, this.restartDelayMs);

    this.restartTimer.unref?.();
  }
}
