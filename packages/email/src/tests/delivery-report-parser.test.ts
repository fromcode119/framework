import { describe, expect, it } from 'vitest';
import { InboundMessageParser } from '@email/inbox/inbound-message-parser';

const bounce = [
  'From: Mail Delivery System <MAILER-DAEMON@mx.example.net>',
  'To: bounces@shop.example',
  'Subject: Undelivered Mail Returned to Sender',
  'Message-ID: <dsn-1@mx.example.net>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/report; report-type=delivery-status; boundary="B"',
  '',
  '--B',
  'Content-Type: text/plain; charset=us-ascii',
  '',
  'I could not deliver your message.',
  '--B',
  'Content-Type: message/delivery-status',
  '',
  'Reporting-MTA: dns; mx.example.net',
  '',
  'Final-Recipient: rfc822; Gone@Example.org',
  'Action: failed',
  'Status: 5.1.1',
  'Diagnostic-Code: smtp; 550 5.1.1 <gone@example.org>: Recipient address',
  '    rejected: User unknown',
  '',
  '--B',
  'Content-Type: text/rfc822-headers',
  '',
  'From: orders@shop.example',
  'To: gone@example.org',
  'Subject: Your order',
  'Message-ID: <abc123@shop.example>',
  '--B--',
  '',
].join('\r\n');

const complaint = [
  'From: feedback@isp.example',
  'To: bounces@shop.example',
  'Subject: Complaint',
  'MIME-Version: 1.0',
  'Content-Type: multipart/report; report-type=feedback-report; boundary="C"',
  '',
  '--C',
  'Content-Type: text/plain',
  '',
  'This is an abuse report.',
  '--C',
  'Content-Type: message/feedback-report',
  '',
  'Feedback-Type: abuse',
  'User-Agent: isp-fbl/1.0',
  'Version: 1',
  'Original-Rcpt-To: <ana@isp.example>',
  '',
  '--C',
  'Content-Type: text/rfc822-headers',
  '',
  'Message-ID: <news-9@shop.example>',
  '--C--',
  '',
].join('\r\n');

describe('DeliveryReportParser', () => {
  it('reads a hard bounce: recipient, status, the server\'s words and the original Message-ID', async () => {
    const message = await InboundMessageParser.parse(1, bounce);
    expect(message.report).toEqual({
      complaint: false,
      originalMessageId: 'abc123@shop.example',
      recipients: [{
        address: 'gone@example.org',
        action: 'failed',
        status: '5.1.1',
        diagnostic: 'smtp; 550 5.1.1 <gone@example.org>: Recipient address rejected: User unknown',
      }],
    });
  });

  it('reads a spam complaint', async () => {
    const message = await InboundMessageParser.parse(2, complaint);
    expect(message.report).toMatchObject({ complaint: true, originalMessageId: 'news-9@shop.example', recipients: [{ address: 'ana@isp.example', action: 'abuse' }] });
  });

  it('says nothing about an ordinary reply', async () => {
    const message = await InboundMessageParser.parse(3, 'From: a@b.example\r\nSubject: Out of office\r\nContent-Type: text/plain\r\n\r\nI am away.\r\n');
    expect(message.report).toBeNull();
  });

  it('ignores a report-shaped block inside an ordinary message', async () => {
    const forged = 'From: x@evil.example\r\nSubject: hi\r\nContent-Type: text/plain\r\n\r\nContent-Type: message/delivery-status\r\n\r\nFinal-Recipient: rfc822; victim@example.org\r\nAction: failed\r\nStatus: 5.1.1\r\n';
    expect((await InboundMessageParser.parse(4, forged)).report).toBeNull();
  });
});
