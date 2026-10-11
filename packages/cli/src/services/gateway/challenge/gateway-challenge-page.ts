import fs from 'fs';
import path from 'path';

/**
 * The browser check page, filled in. The markup and its styles live in `gateway-challenge-page.html`;
 * the words are the operator's (Settings → Security → Edge protection), escaped here.
 */
export class GatewayChallengePage {
  private static readonly FILE = path.join(__dirname, 'gateway-challenge-page.html');

  constructor(private readonly template: string = fs.readFileSync(GatewayChallengePage.FILE, 'utf8')) {}

  render(fields: { title: string; message: string; host: string; token: string; bits: number; back: string; verify: string; nonce: string }): string {
    const values: Record<string, string> = {
      title: GatewayChallengePage.html(fields.title),
      message: GatewayChallengePage.html(fields.message),
      host: GatewayChallengePage.html(fields.host),
      nonce: GatewayChallengePage.html(fields.nonce),
      bits: String(Math.trunc(fields.bits)),
      token: GatewayChallengePage.script(fields.token),
      back: GatewayChallengePage.script(fields.back),
      verify: GatewayChallengePage.script(fields.verify),
    };
    return this.template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => values[name] ?? match);
  }

  private static html(value: string): string {
    return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }

  /** A JavaScript string literal that cannot close the script element it sits in. */
  private static script(value: string): string {
    return JSON.stringify(String(value)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  }
}
