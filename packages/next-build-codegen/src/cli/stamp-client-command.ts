import path from 'node:path';
import { ClientDirectiveStamper } from '../client-directive-stamper';
import { NextorCommand } from './next-build-codegen-command';

/** `next-build-codegen stamp-client [distDir]` — stamp Next's `'use client'` into compiled `*.client.js` output. */
export class StampClientCommand extends NextorCommand {
  readonly summary = "Stamp 'use client' into compiled *.client.js output [distDir].";

  run(argv: string[]): number {
    const distDir = path.resolve(process.cwd(), argv[0] || 'dist');
    const { stamped, total } = ClientDirectiveStamper.stampDir(distDir);
    console.log(`[next-build-codegen] stamped 'use client' into ${stamped}/${total} .client.js file(s) under ${path.relative(process.cwd(), distDir) || '.'}`);
    return 0;
  }
}
