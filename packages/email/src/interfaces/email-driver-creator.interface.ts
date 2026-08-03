import type { IEmailDriver } from '@email/interfaces/email-driver.interface';

/** Factory that builds a EmailDriver from config (callable contract — was a `type` alias). */
export interface IEmailDriverCreator {
  (config: any): IEmailDriver;
}
