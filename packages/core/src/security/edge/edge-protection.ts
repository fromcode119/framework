/**
 * What the gateway enforces in front of the apps, as the admin set it (Settings → Security → Edge
 * protection). Built by the api from the settings and carried to the gateway with the routing map.
 *
 * `underAttack` lists the sites whose visitors must pass a browser check; `null` in it means the
 * platform's own hosts. The rest describes the check itself, the same for every site.
 */
export class EdgeProtection {
  static readonly NONE = new EdgeProtection([], 0, [], '', '');

  constructor(
    readonly underAttack: ReadonlyArray<string | null>,
    readonly clearanceMinutes: number,
    readonly exemptPaths: readonly string[],
    readonly title: string,
    readonly message: string,
  ) {}

  /** Whether the hosts of this site (null: the platform's own) are under attack mode. */
  isUnderAttack(tenantId: string | null): boolean {
    return this.underAttack.includes(tenantId ?? null);
  }

  /** Whether this request path is one the check never applies to. */
  isExempt(pathname: string): boolean {
    const path = String(pathname || '/');
    return this.exemptPaths.some((prefix) => prefix.length > 0 && path.startsWith(prefix));
  }

  toJSON(): Record<string, unknown> {
    return {
      underAttack: [...this.underAttack],
      clearanceMinutes: this.clearanceMinutes,
      exemptPaths: [...this.exemptPaths],
      title: this.title,
      message: this.message,
    };
  }

  static fromJson(raw: unknown): EdgeProtection {
    const value = (raw ?? {}) as Record<string, unknown>;
    const list = (entry: unknown): unknown[] => (Array.isArray(entry) ? entry : []);
    const minutes = Number(value.clearanceMinutes);
    return new EdgeProtection(
      list(value.underAttack).map((id) => (id === null ? null : String(id))),
      Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
      list(value.exemptPaths).map((path) => String(path)),
      String(value.title ?? ''),
      String(value.message ?? ''),
    );
  }
}
