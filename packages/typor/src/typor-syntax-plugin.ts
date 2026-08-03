/**
 * The syntax half of typor: makes an `extends` clause naming two bases a legal thing to WRITE.
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
 */
export class TyporSyntaxPlugin {
  static readonly IMPORT_LINE = "import { Typor } from '@fromcode119/typor';";

  /** Split an extends clause on TOP-LEVEL commas only (ignoring <>, (), [], {} and strings). */
  static splitBases(clause: string): string[] {
    const parts: string[] = [];
    let depth = 0, quote: string | null = null, current = '';
    for (let i = 0; i < clause.length; i += 1) {
      const ch = clause[i];
      if (quote) {
        current += ch;
        if (ch === quote && clause[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth -= 1;
      if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
  }

  /**
   * A copy of `source` with comments and string/template contents replaced by spaces, preserving length
   * and line structure. All scanning runs against THIS, so an `extends` clause naming two bases written inside a doc
   * comment (as it is in typor's own docs) is never mistaken for real code — the mistake that has
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

  /** Locate every `class X extends <clause> {` with more than one base. */
  private static findClauses(source: string): Array<{ start: number; end: number; clause: string }> {
    const found: Array<{ start: number; end: number; clause: string }> = [];
    // scan the MASKED copy so comments/strings can never match; offsets stay valid against `source`
    const scan = TyporSyntaxPlugin.maskNonCode(source);
    const head = /\bclass\s+[A-Za-z_$][\w$]*(?:<[^{]*?>)?\s+extends\s+/g;
    let m = head.exec(scan);
    while (m) {
      // the clause runs to the `{` that opens the body, at depth 0
      let depth = 0, i = m.index + m[0].length, end = -1;
      for (; i < scan.length; i += 1) {
        const ch = scan[i];
        if (ch === '<' || ch === '(' || ch === '[') depth += 1;
        else if (ch === '>' || ch === ')' || ch === ']') depth -= 1;
        else if (ch === '{' && depth === 0) { end = i; break; }
        else if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
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
    if (!/from\s+['"]@fromcode119\/typor['"]/.test(out)) {
      // append to the FIRST line so no line numbers shift
      const lines = out.split('\n');
      lines[0] = `${TyporSyntaxPlugin.IMPORT_LINE} ${lines[0]}`;
      out = lines.join('\n');
    }
    return out;
  }
}
