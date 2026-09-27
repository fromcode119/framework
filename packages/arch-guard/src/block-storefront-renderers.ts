import path from 'node:path';
import { BlockFieldSourceReader } from './block-field-source-reader';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * The storefront renderer another extension registers for a block, found by its declared slot.
 *
 * A block's editor and its live renderer need not live in the same extension. The CMS defines
 * `contact-form` and ships only an editor PREVIEW for it, while the forms plugin renders it on the
 * storefront by declaring `{ name: 'cms.block.contact-form' }`. Judged against the preview, every
 * working control on that block read as FAKE. A declared slot is the link, so it is followed here.
 */
export class BlockStorefrontRenderers {
  /** Read once per set of trees: every block asks, and the answer only changes with the trees. */
  private static cache: { trees: string; files: Array<{ file: string; source: string }> } | null = null;

  /** The comment-free source of every storefront renderer declaring `cms.block.<blockId>`, or null. */
  static sourceFor(blockId: string): string | null {
    const slot = new RegExp(`['"]cms\\.block\\.${blockId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]`);
    const matches = BlockStorefrontRenderers.all().filter(({ source }) => slot.test(source));
    return matches.length ? matches.map(({ source }) => source).join('\n') : null;
  }

  /** Code with its comments removed: a note naming a key is not a use of it. */
  static stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');
  }

  private static all(): Array<{ file: string; source: string }> {
    const trees = ExtensionTrees.dirs(['plugins', 'themes']);
    const key = trees.join('\n');
    if (BlockStorefrontRenderers.cache?.trees === key) return BlockStorefrontRenderers.cache.files;
    const files = trees
      .flatMap((tree) => [...BlockFieldSourceReader.walk(tree, /\.storefront\.tsx?$/)])
      .filter((file) => !file.split(path.sep).includes('node_modules'))
      .map((file) => ({ file, source: BlockStorefrontRenderers.stripComments(BlockFieldSourceReader.read(file)) }));
    BlockStorefrontRenderers.cache = { trees: key, files };
    return files;
  }
}
