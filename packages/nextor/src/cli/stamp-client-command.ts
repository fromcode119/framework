import path from 'node:path';
import { ClientDirectiveStamper } from '../client-directive-stamper';
import { NextorCommand } from './nextor-command';

/** `nextor stamp-client [distDir]` — stamp Next's `'use client'` into compiled `*.client.js` output. */
export class StampClientCommand extends NextorCommand {
  readonly summary = "Stamp 'use client' into compiled *.client.js output [distDir].";

  run(argv: string[]): number {
    const distDir = path.resolve(process.cwd(), argv[0] || 'dist');
    const { stamped, total } = ClientDirectiveStamper.stampDir(distDir);
    console.log(`[nextor] stamped 'use client' into ${stamped}/${total} .client.js file(s) under ${path.relative(process.cwd(), distDir) || '.'}`);
    return 0;
  }
}
