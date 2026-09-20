/* eslint-disable */
import { SourceTree } from './source-tree';

/**
 * A translation key in snake_case, at the call site.
 *
 * Keys are camelCase like every other name this codebase owns — `t('checkout.errors.paymentMethodNotAllowed')` —
 * and a second spelling is the same duplication the field rule is about, one layer up. Only STATIC
 * literals are visible here: a key built from a variable cannot be read without running the code.
 *
 * Reports, never gates. The one finding that stands is a plugin whose macro descriptions deliberately
 * mirror the macro names an operator types into a template (`{% for p in lead_paragraphs %}`), which
 * is a product-surface decision rather than a naming slip — exactly the judgement a guard should
 * surface to a person instead of deciding for them.
 */
export class SnakeTranslationKeyGuard {
  private static readonly SKIP = new Set(['ui-ssr']);

  static run(): number {
    const hits: string[] = [];

    for (const file of SourceTree.typescript(SnakeTranslationKeyGuard.SKIP)) {
      SourceTree.lines(file).forEach((line, index) => {
        const keys = line.matchAll(/\b(?:t|tr|translate)\(\s*(['"])([A-Za-z][A-Za-z0-9_.]*_[A-Za-z0-9_.]*)\1/g);
        for (const key of keys) hits.push(`${SourceTree.cite(file)}:${index + 1}  ${key[2]}`);
      });
    }

    console.log(`Static t() keys still spelled snake_case: ${hits.length}`);
    for (const hit of hits) console.log(`  ${hit}`);
    return 0;
  }
}
