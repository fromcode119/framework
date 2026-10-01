import { describe, expect, it } from 'vitest';
import { InboundMessageParser } from '@email/inbox/inbound-message-parser';

describe('InboundMessageParser', () => {
  it('reduces a reply to its sender, threading headers and text', async () => {
    const raw = [
      'From: "Ana Test" <Ana@Example.com>',
      'To: support@shop.example',
      'Subject: Re: Where is my order? [HD-7K3P9QAB]',
      'Message-ID: <reply-1@example.com>',
      'In-Reply-To: <hd-7k3p9qab.1@shop.example>',
      'References: <hd-7k3p9qab@shop.example> <hd-7k3p9qab.1@shop.example>',
      'Date: Thu, 01 Oct 2026 10:00:00 +0000',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Thank you, it arrived.',
      '',
    ].join('\r\n');
    const message = await InboundMessageParser.parse(42, raw);
    expect(message).toMatchObject({
      uid: 42,
      messageId: '<reply-1@example.com>',
      inReplyTo: '<hd-7k3p9qab.1@shop.example>',
      references: ['<hd-7k3p9qab@shop.example>', '<hd-7k3p9qab.1@shop.example>'],
      fromAddress: 'ana@example.com',
      fromName: 'Ana Test',
      subject: 'Re: Where is my order? [HD-7K3P9QAB]',
      date: '2026-10-01T10:00:00.000Z',
    });
    expect(message.text.trim()).toBe('Thank you, it arrived.');
  });

  it('takes the text from an HTML-only message', async () => {
    const raw = ['From: bo@example.com', 'Subject: Hi', 'Content-Type: text/html; charset=utf-8', '', '<p>Hello <b>there</b></p>', ''].join('\r\n');
    expect((await InboundMessageParser.parse(1, raw)).text.trim()).toBe('Hello there');
  });
});
