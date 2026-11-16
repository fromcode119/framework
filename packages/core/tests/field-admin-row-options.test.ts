import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A field option the console READS must exist on the type a plugin DECLARES against.
 *
 * `layout`, `pattern`, `patternNote`, `inPlace` and `sectionLayout` were documented only on the admin's
 * own field interface, which carries an index signature and so accepts anything. `IFieldInput` does
 * not, and TypeScript's weak-type rule refuses an `admin` object with NO key in common with the
 * declared shape — so a plugin declaring a list of rows (`admin: { pattern, patternNote }` on the
 * row's field and nothing else) failed the backend typecheck while the console rendered it perfectly.
 * The option existed at its read site and nowhere a plugin could reach.
 *
 * This reads the interface SOURCE rather than assigning a literal, because `packages/core/tsconfig.json`
 * excludes tests from the typecheck: an assignment here would compile under vitest's esbuild, which
 * strips types without checking them, and would prove nothing. What proves the whole path is CI's
 * `plugin-backend-types` guard over the plugins that declare these options.
 */
describe('the field a plugin declares carries the options the console reads', () => {
  const source = readFileSync(path.join(__dirname, '../src/interfaces/field.interface.ts'), 'utf8');

  it.each(['inPlace?: boolean;', 'layout?: string;', 'pattern?: string;', 'patternNote?: string;', 'sectionLayout?: string;'])(
    'declares %s',
    (declaration) => {
      expect(source).toContain(declaration);
    },
  );
});
