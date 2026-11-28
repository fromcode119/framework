import type { IDeliveryReport } from '@email/interfaces/delivery-report.interface';
import type { IDeliveryReportRecipient } from '@email/interfaces/delivery-report-recipient.interface';

/**
 * Reads the machine part of a bounce (`message/delivery-status`, RFC 3464) or a spam complaint
 * (`message/feedback-report`, RFC 5965) out of the RAW message. Only these standard parts are read:
 * guessing from the human-readable text of a bounce is how a vacation reply ends up suppressing a real
 * customer. Raw, because the mail parser folds a delivery-status part into the body text and never
 * hands it over as a part of its own.
 */
export class DeliveryReportParser {
  static parse(source: string): IDeliveryReport | null {
    const original = DeliveryReportParser.part(source, 'text/rfc822-headers') ?? DeliveryReportParser.part(source, 'message/rfc822');
    const originalMessageId = DeliveryReportParser.messageId(original ?? '');

    const status = DeliveryReportParser.part(source, 'message/delivery-status');
    if (status !== null) {
      const recipients = DeliveryReportParser.blocks(status)
        .map((fields) => DeliveryReportParser.recipient(fields))
        .filter((recipient): recipient is IDeliveryReportRecipient => recipient !== null);
      return recipients.length ? { kind: 'delivery-status', originalMessageId, recipients } : null;
    }

    const feedback = DeliveryReportParser.part(source, 'message/feedback-report');
    if (feedback !== null) {
      const fields = DeliveryReportParser.fields(feedback);
      const address = DeliveryReportParser.address(fields['original-rcpt-to'] || fields['removal-recipient'] || '');
      if (!address) return null;
      return { kind: 'complaint', originalMessageId, recipients: [{ address, action: String(fields['feedback-type'] || 'abuse').toLowerCase(), status: '', diagnostic: '' }] };
    }
    return null;
  }

  /** The body of the first MIME part of `type`: after its headers, up to the next boundary line. */
  private static part(source: string, type: string): string | null {
    const header = new RegExp(`^content-type:\\s*${type.replace('/', '\\/')}\\b[^\\n]*(?:\\r?\\n[ \\t][^\\n]*)*`, 'im').exec(source);
    if (!header) return null;
    const rest = source.slice(header.index + header[0].length);
    const start = /\r?\n\r?\n/.exec(rest);
    if (!start) return null;
    const body = rest.slice(start.index + start[0].length);
    const end = /^--[^\r\n]+$/m.exec(body);
    return end ? body.slice(0, end.index) : body;
  }

  /** The per-recipient field groups: a delivery-status body is blank-line-separated blocks. */
  private static blocks(body: string): Array<Record<string, string>> {
    return body.split(/\r?\n\s*\r?\n/).map((block) => DeliveryReportParser.fields(block)).filter((fields) => fields['final-recipient'] || fields['original-recipient']);
  }

  private static recipient(fields: Record<string, string>): IDeliveryReportRecipient | null {
    const address = DeliveryReportParser.address(fields['final-recipient'] || fields['original-recipient'] || '');
    if (!address) return null;
    return {
      address,
      action: String(fields.action || '').trim().toLowerCase(),
      status: String(fields.status || '').trim().split(/\s/)[0] ?? '',
      diagnostic: String(fields['diagnostic-code'] || '').trim(),
    };
  }

  /** `Name: value` lines, continuation lines folded in, names lower-cased. */
  private static fields(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    let last = '';
    for (const line of block.split(/\r?\n/)) {
      if (/^\s/.test(line) && last) {
        out[last] += ` ${line.trim()}`;
        continue;
      }
      const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
      if (!match) continue;
      last = match[1].toLowerCase();
      out[last] = match[2].trim();
    }
    return out;
  }

  /** `rfc822; someone@example.com` → `someone@example.com`. */
  private static address(value: string): string {
    const raw = value.includes(';') ? value.slice(value.indexOf(';') + 1) : value;
    return raw.trim().replace(/^<|>$/g, '').toLowerCase();
  }

  private static messageId(headers: string): string {
    const match = /^message-id:\s*<?([^>\s]+)>?/im.exec(headers);
    return match ? match[1].trim() : '';
  }
}
