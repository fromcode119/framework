import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { BuildStepResult } from '@extension-builder/build-step-result';

/**
 * Writes a `.gz` beside every built `.js` and `.css`, so a static server can serve the compressed
 * copy without compressing on every request. The original is always kept.
 */
export class AssetPrecompressor {
  static readonly STEP = 'asset-precompressor';

  static compress(dir: string): BuildStepResult {
    if (!fs.existsSync(dir)) return BuildStepResult.skipped(AssetPrecompressor.STEP, `no ${dir}`);

    const files = fs.readdirSync(dir)
      .filter((name) => (name.endsWith('.js') || name.endsWith('.css')) && !name.endsWith('.gz'))
      .map((name) => path.join(dir, name))
      .filter((file) => fs.statSync(file).isFile());
    if (files.length === 0) return BuildStepResult.skipped(AssetPrecompressor.STEP, 'no .js or .css files');

    for (const file of files) {
      fs.writeFileSync(`${file}.gz`, zlib.gzipSync(fs.readFileSync(file), { level: 9 }));
    }
    return BuildStepResult.ok(AssetPrecompressor.STEP);
  }
}
