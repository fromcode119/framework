/** One received email, reduced to what an application acts on. */
export interface IInboundMessage {
  uid: number;
  messageId: string;
  inReplyTo: string;
  references: string[];
  fromAddress: string;
  fromName: string;
  subject: string;
  /** The plain-text body (from the HTML part when there is no text part). */
  text: string;
  date: string | null;
}
