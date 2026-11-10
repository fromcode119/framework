/**
 * Compose's `${…}` substitution, against the deployment's `.env` — the values `docker compose up` in the
 * deployment folder would use.
 *
 * `${A}`, `$A`, `${A:-default}` / `${A-default}` (empty or unset / unset only), `${A:?message}` /
 * `${A?message}` (refuse), `${A:+alt}` / `${A+alt}`, and `$$` for a literal `$`. Defaults may nest
 * (`${EDGE_IMAGE:-…:${VERSION:-latest}}`, which the images file uses). Applied to values, never to keys.
 */
export class ComposeInterpolation {
  constructor(private readonly env: Record<string, string>) {}

  /** Every string in `value`, at any depth, substituted. */
  deep(value: unknown): unknown {
    if (typeof value === 'string') return this.text(value);
    if (Array.isArray(value)) return value.map((item) => this.deep(item));
    if (value && typeof value === 'object' && value.constructor === Object) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.deep(item)]));
    }
    return value;
  }

  text(input: string): string {
    let out = '';
    let index = 0;
    while (index < input.length) {
      const char = input[index];
      if (char !== '$') { out += char; index += 1; continue; }
      const next = input[index + 1];
      if (next === '$') { out += '$'; index += 2; continue; }
      if (next === '{') {
        const end = ComposeInterpolation.closing(input, index + 2);
        out += this.expression(input.slice(index + 2, end));
        index = end + 1;
        continue;
      }
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(index + 1))?.[0];
      if (!name) { out += char; index += 1; continue; }
      out += this.env[name] ?? '';
      index += 1 + name.length;
    }
    return out;
  }

  private expression(body: string): string {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?)([-?+])([\s\S]*))?$/.exec(body);
    if (!match) throw new Error(`Cannot read "\${${body}}" in the compose files.`);
    const [, name, colon, operator, rest] = match;
    const value = this.env[name];
    const missing = colon ? !value : value === undefined;
    if (!operator) return value ?? '';
    if (operator === '-') return missing ? this.text(rest) : value!;
    if (operator === '+') return missing ? '' : this.text(rest);
    if (missing) throw new Error(`${name} must be set in .env: ${this.text(rest) || 'the compose files require it'}`);
    return value!;
  }

  /** The `}` that closes the `${` opened just before `from`, past any nested `${…}`. */
  private static closing(input: string, from: number): number {
    let depth = 1;
    for (let index = from; index < input.length; index += 1) {
      if (input[index] === '$' && input[index + 1] === '{') { depth += 1; index += 1; continue; }
      if (input[index] === '}' && (depth -= 1) === 0) return index;
    }
    throw new Error(`Unclosed "\${" in the compose files: ${input}`);
  }
}
