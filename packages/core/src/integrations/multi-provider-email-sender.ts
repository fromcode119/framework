import type { IEmailDriver, IEmailOptions } from '@fromcode119/email';
import { Logger } from '@core/logging';

export class MultiProviderEmailSender {
  constructor(
    private providers: Array<{ key: string; sender: IEmailDriver }>,
    private logger: Logger
  ) {}

  async send(options: IEmailOptions): Promise<any> {
    const settled = await Promise.allSettled(
      this.providers.map(async (entry) => {
        const result = await entry.sender.send(options);
        return { key: entry.key, result };
      })
    );

    const failed = settled
      .filter((item) => item.status === 'rejected')
      .map((item) => String((item as any).reason?.message || (item as any).reason || 'unknown error'));

    const succeeded = settled.filter((item) => item.status === 'fulfilled').length;

    if (!succeeded) {
      throw new Error(`All enabled email providers failed: ${failed.join(' | ')}`);
    }

    if (failed.length) {
      this.logger.warn(
        `Email delivered with partial provider failures (${succeeded}/${this.providers.length} succeeded): ${failed.join(' | ')}`
      );
    }

    const firstSuccess = settled.find((item) => item.status === 'fulfilled') as PromiseFulfilledResult<any> | undefined;
    return firstSuccess?.value?.result;
  }
}