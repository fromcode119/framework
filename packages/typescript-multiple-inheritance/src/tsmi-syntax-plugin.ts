/**
 * The syntax half of typescript-multiple-inheritance: makes an `extends` clause naming two bases a legal thing to WRITE.
 *
 * TypeScript is single-inheritance, so that clause is a parse error. This plugin rewrites it at BUILD
 * time into a `Typor.mixin(...)` call — the source stays clean OOP, the compiler never sees
 * the extended syntax, and `Typor.mixin` supplies the real behaviour.
 *
 * The rewrite is deliberately LINE-PRESERVING: it never adds or removes a newline, so `tsc` error
 * positions on the transformed file map 1:1 back to the original. That is what makes it safe to
 * typecheck through a shadow copy.
 *
 * Commas inside generics/parens are NOT separators — a generic base with a comma inside it is a SINGLE base. Getting
 * that wrong flipped 333 classes into interfaces once already, so the split is depth-aware, not a regex.
 *
 * The `>` of an arrow (`=>`) closes nothing. Counted as a bracket, a props type such as
 * `extends Base<{ onChange: () => void; map: Record<string, string> }>` left the scan below zero: the
 * clause ran on into the class body, whose commas then read as further bases, and a single-base class
 * was rewritten into a `Typor.mixin(...)` that does not parse.
 */
export class TyporSyntaxPlugin {
  static readonly IMPORT_LINE = "import { Typor } from '@fromcode119/typescript-multiple-inheritance';";

  /** True when the `>` at `index` is the head of an arrow (`=>`), which closes no bracket. */
  private static isArrow(text: string, index: number): boolean {
    return text[index] === '>' && text[index - 1] === '=';
  }

  /**
   * Split an extends clause on TOP-LEVEL commas only (ignoring <>, (), [], {}, arrows, comments and strings).
   * The commas are found on the masked copy, so a comma or an apostrophe in a comment or a string between
   * the bases can never split them or open a quote.
   */
  static splitBases(clause: string): string[] {
    const scan = TyporSyntaxPlugin.maskNonCode(clause);
    const parts: string[] = [];
    let depth = 0, from = 0;
    for (let i = 0; i < scan.length; i += 1) {
      const ch = scan[i];
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if ((ch === '>' && !TyporSyntaxPlugin.isArrow(scan, i)) || ch === ')' || ch === ']' || ch === '}') depth -= 1;
      else if (ch === ',' && depth === 0) { parts.push(clause.slice(from, i).trim()); from = i + 1; }
    }
    parts.push(clause.slice(from).trim());
    return parts.filter(Boolean);
  }

  /**
   * A copy of `source` with comments and string/template contents replaced by spaces, preserving length
   * and line structure. All scanning runs against THIS, so an `extends` clause naming two bases written inside a doc
   * comment (as it is in typescript-multiple-inheritance's own docs) is never mistaken for real code — the mistake that has
   * corrupted this repo before.
   */
  static maskNonCode(source: string): string {
    const out = source.split('');
    let i = 0;
    const blank = (from: number, to: number) => {
      for (let j = from; j < to && j < out.length; j += 1) if (out[j] !== '\n') out[j] = ' ';
    };
    while (i < source.length) {
      const two = source.slice(i, i + 2);
      if (two === '//') { const end = source.indexOf('\n', i); const stop = end === -1 ? source.length : end; blank(i, stop); i = stop; continue; }
      if (two === '/*') { const end = source.indexOf('*/', i + 2); const stop = end === -1 ? source.length : end + 2; blank(i, stop); i = stop; continue; }
      const ch = source[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < source.length && !(source[j] === ch && source[j - 1] !== '\\')) j += 1;
        blank(i + 1, j); i = j + 1; continue;
      }
      i += 1;
    }
    return out.join('');
  }

  /** True when the source declares a multi-base `extends`. */
  static handles(source: string): boolean {
    return TyporSyntaxPlugin.findClauses(source).length > 0;
  }

  /** True when the `implements` KEYWORD starts at `index` (word-bounded, so `implementsFoo` is not one). */
  private static startsImplements(scan: string, index: number): boolean {
    if (!scan.startsWith('implements', index)) return false;
    const before = index === 0 ? ' ' : scan[index - 1];
    const after = scan[index + 'implements'.length] ?? ' ';
    return !/[\w$]/.test(before) && !/[\w$]/.test(after);
  }

  /** Locate every `class X extends <clause> {` with more than one base. */
  private static findClauses(source: string): Array<{ start: number; end: number; clause: string }> {
    const found: Array<{ start: number; end: number; clause: string }> = [];
    // scan the MASKED copy so comments/strings can never match; offsets stay valid against `source`
    const scan = TyporSyntaxPlugin.maskNonCode(source);
    const head = /\bclass\s+[A-Za-z_$][\w$]*(?:<[^{]*?>)?\s+extends\s+/g;
    let m = head.exec(scan);
    while (m) {
      // the clause runs to the `{` that opens the body, at depth 0 — or to an `implements` keyword,
      // whichever comes first. `class X extends A implements IB, IC {` is ordinary TypeScript, and
      // running to the `{` swallowed the implements list: its comma made ONE base look like two, and
      // the rewrite emitted `Typor.mixin(A implements IB, IC)` — a syntax error in a file the author
      // never touched, surfacing only as an unexplained +2 in the app-typecheck ratchet.
      let depth = 0, i = m.index + m[0].length, end = -1;
      for (; i < scan.length; i += 1) {
        const ch = scan[i];
        if (ch === '<' || ch === '(' || ch === '[') depth += 1;
        else if ((ch === '>' && !TyporSyntaxPlugin.isArrow(scan, i)) || ch === ')' || ch === ']') depth -= 1;
        else if (ch === '{' && depth === 0) { end = i; break; }
        else if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        else if (depth === 0 && TyporSyntaxPlugin.startsImplements(scan, i)) { end = i; break; }
      }
      if (end > -1) {
        const clause = source.slice(m.index + m[0].length, end);
        if (TyporSyntaxPlugin.splitBases(clause).length > 1) {
          found.push({ start: m.index + m[0].length, end, clause });
        }
      }
      m = head.exec(scan);
    }
    return found;
  }

  /** Rewrite multi-base `extends` clauses. Idempotent and line-preserving. */
  static transform(source: string): string {
    const clauses = TyporSyntaxPlugin.findClauses(source);
    if (!clauses.length) return source;
    let out = source;
    for (const { start, end, clause } of clauses.reverse()) {
      const bases = TyporSyntaxPlugin.splitBases(clause);
      // preserve the original newline count so tsc positions still line up
      const newlines = '\n'.repeat((clause.match(/\n/g) || []).length);
      out = `${out.slice(0, start)}Typor.mixin(${bases.join(', ')})${newlines} ${out.slice(end)}`;
    }
    if (!/from\s+['"]@fromcode119\/typescript-multiple-inheritance['"]/.test(out)) {
      // append to the FIRST line so no line numbers shift
      const lines = out.split('\n');
      lines[0] = `${TyporSyntaxPlugin.IMPORT_LINE} ${lines[0]}`;
      out = lines.join('\n');
    }
    return out;
  }
}
