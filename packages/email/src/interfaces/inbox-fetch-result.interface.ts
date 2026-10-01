import type { IInboundMessage } from '@email/interfaces/inbound-message.interface';

/**
 * What a read found. `uidValidity` changes when the server renumbers the folder; a caller that stored a
 * `sinceUid` must then start again from 0.
 */
export interface IInboxFetchResult {
  uidValidity: string;
  lastUid: number;
  messages: IInboundMessage[];
}
