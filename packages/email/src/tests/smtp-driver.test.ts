import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { SMTPDriver } from '@email/drivers/smtp';

/** A minimal SMTP listener that records the envelope sender (`MAIL FROM`) of each message. */
class EnvelopeRecorder {
  readonly senders: string[] = [];

  private server = net.createServer((socket) => {
    let inData = false;
    socket.write('220 localhost ESMTP\r\n');
    socket.on('data', (chunk) => {
      for (const line of chunk.toString().split('\r\n').filter(Boolean)) {
        if (inData) {
          if (line === '.') { inData = false; socket.write('250 OK\r\n'); }
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) socket.write('250 localhost\r\n');
        else if (command.startsWith('MAIL FROM')) { this.senders.push(line.slice(10).replace(/[<>]/g, '').split(' ')[0]); socket.write('250 OK\r\n'); }
        else if (command.startsWith('RCPT TO')) socket.write('250 OK\r\n');
        else if (command === 'DATA') { inData = true; socket.write('354 go\r\n'); }
        else if (command === 'QUIT') { socket.end('221 bye\r\n'); }
        else socket.write('250 OK\r\n');
      }
    });
  });

  async listen(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return (this.server.address() as net.AddressInfo).port;
  }

  close(): void {
    this.server.close();
  }
}

describe('SMTPDriver sender', () => {
  let recorder: EnvelopeRecorder;

  afterEach(() => recorder?.close());

  it('sends as the configured From, not the Reply-To, when the caller names no sender', async () => {
    recorder = new EnvelopeRecorder();
    const port = await recorder.listen();
    const driver = new SMTPDriver({ host: '127.0.0.1', port, secure: false, ignoreTLS: true, from: '"Shop" <notifications@example.com>' } as any);

    await driver.send({ to: 'owner@example.com', subject: 'New submission', text: 'x', headers: { 'Reply-To': 'visitor@example.org' } });

    expect(recorder.senders).toEqual(['notifications@example.com']);
  });

  it('keeps an explicit sender from the caller', async () => {
    recorder = new EnvelopeRecorder();
    const port = await recorder.listen();
    const driver = new SMTPDriver({ host: '127.0.0.1', port, secure: false, ignoreTLS: true, from: 'notifications@example.com' } as any);

    await driver.send({ from: 'auth@example.com', to: 'owner@example.com', subject: 'Reset', text: 'x' });

    expect(recorder.senders).toEqual(['auth@example.com']);
  });
});
