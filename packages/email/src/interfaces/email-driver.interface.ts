import type { IEmailOptions } from '@email/interfaces/email-options.interface';

export interface IEmailDriver {
  send(options: IEmailOptions): Promise<any>;
}
