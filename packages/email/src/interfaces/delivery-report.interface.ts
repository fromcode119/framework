import type { IDeliveryReportRecipient } from '@email/interfaces/delivery-report-recipient.interface';

/**
 * What a bounce or complaint message says about mail the platform sent: which message (its
 * `Message-ID`), which recipients, and what happened to each.
 */
export interface IDeliveryReport {
  kind: 'delivery-status' | 'complaint';
  /** The `Message-ID` of the email the report is about, without angle brackets; empty when absent. */
  originalMessageId: string;
  recipients: IDeliveryReportRecipient[];
}
