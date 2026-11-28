import type { IDeliveryReportRecipient } from '@email/interfaces/delivery-report-recipient.interface';

/**
 * What a bounce or complaint message says about mail the platform sent: which message (its
 * `Message-ID`), which recipients, and what happened to each.
 */
export interface IDeliveryReport {
  /** True for a spam complaint (RFC 5965), false for a delivery status report (RFC 3464). */
  complaint: boolean;
  /** The `Message-ID` of the email the report is about, without angle brackets; empty when absent. */
  originalMessageId: string;
  recipients: IDeliveryReportRecipient[];
}
