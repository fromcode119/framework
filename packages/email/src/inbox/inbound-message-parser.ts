import { simpleParser } from 'mailparser';
import type { IInboundMessage } from '@email/interfaces/inbound-message.interface';

/** A raw RFC 822 message, reduced to what an application acts on. */
export class InboundMessageParser {
  static async parse(uid: number, source: Buffer | string): Promise<IInboundMessage> {
    const parsed = await simpleParser(source);
    const from = parsed.from?.value?.[0];
    const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
    return {
      uid,
      messageId: String(parsed.messageId ?? ''),
      inReplyTo: String(parsed.inReplyTo ?? ''),
      references: references.map((reference) => String(reference)),
      fromAddress: String(from?.address ?? '').toLowerCase(),
      fromName: String(from?.name ?? ''),
      subject: String(parsed.subject ?? ''),
      text: String(parsed.text ?? ''),
      date: parsed.date ? parsed.date.toISOString() : null,
    };
  }
}
