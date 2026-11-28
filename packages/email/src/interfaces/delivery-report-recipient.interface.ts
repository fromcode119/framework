/** One recipient line of a delivery report (RFC 3464) or a spam complaint (RFC 5965). */
export interface IDeliveryReportRecipient {
  address: string;
  /** `failed`, `delayed`, `delivered`, … as the report says; `abuse` for a complaint. */
  action: string;
  /** The enhanced status code (`5.1.1`); empty when the report gives none. */
  status: string;
  /** The remote server's own words (`smtp; 550 5.1.1 User unknown`). */
  diagnostic: string;
}
