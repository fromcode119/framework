/** Type aliases for EmailFactory */
import type { EmailDriver } from './email-factory.interfaces';

export type EmailDriverCreator = (config: any) => EmailDriver;
