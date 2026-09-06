import { RequestContextUtils } from '@core/context/request-context';
import { CoreServices } from '@core/services/core-services';
import { AssistantVocabularyRole } from '@core/services/enums/assistant-vocabulary-role.enum';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import type { PluginContext } from '@core/plugin-context';

/**
 * Runs one guest call against the REAL context, under the tenant the call's token was minted for.
 *
 * The token is resolved on the host's own record (PluginInvocationTokens); an unknown token is
 * refused before anything is looked at. The call is then re-entered into the request context the
 * invocation was started from, and — when that context has a tenant — into a tenant-bound database
 * scope, so row-level security applies to every statement exactly as it would in-process.
 *
 * The walk is generic: property, or call with args, step by step. Two roots besides the context:
 * `core` (the CoreServices registries plugins reach for directly) and `ddl` (the owner connection,
 * for migrations the guest runs as code).
 */
export class PluginHostDispatcher {
  constructor(
    private readonly slug: string,
    private readonly tokens: PluginInvocationTokens,
    private readonly db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> },
    private readonly ddl: unknown,
    private readonly callbacks: PluginHostCallbacks,
  ) {}

  async dispatch(context: PluginContext, call: IPluginRemoteCall): Promise<unknown> {
    const invocation = this.tokens.resolve(call.token);
    if (!invocation) {
      throw Object.assign(new Error(`unknown_invocation: plugin "${this.slug}" presented a token the host did not mint`), { code: 'unknown_invocation' });
    }
    const execute = () => this.walk(this.root(context, call.root), call.steps);
    // No store means the invocation was not started from a request (boot, a scheduler tick): the call
    // runs OUTSIDE any request context, exactly as the in-process plugin's would, so the context's own
    // untenanted-boot handling applies (skip-and-warn) instead of "no tenant in the request" rejections.
    if (!invocation.store) return execute();
    const store = invocation.store;
    return RequestContextUtils.storage.run(store, () => (invocation.tenantId ? this.db.withTenant(invocation.tenantId, execute) : execute()));
  }

  private root(context: PluginContext, root: IPluginRemoteCall['root']): unknown {
    if (root === 'context') return context;
    if (root === 'core') return CoreServices.getInstance();
    if (root === 'ddl') return this.ddl;
    throw new Error(`unknown call root "${root}"`);
  }

  private async walk(start: unknown, steps: IPluginRemoteCall['steps']): Promise<unknown> {
    let target: any = start;
    let owner: any = undefined;
    for (const step of steps) {
      if (target === null || target === undefined) throw new Error(`cannot read "${step.name}" of ${target}`);
      const next = target[step.name];
      if (step.args) {
        if (typeof next !== 'function') throw new Error(`"${step.name}" is not callable`);
        owner = target;
        target = await next.apply(owner, this.revive(step.name, step.args));
      } else {
        owner = target;
        target = next;
      }
    }
    return PluginHostDispatcher.portableResult(target);
  }

  /** Values that crossed as their wire form and must be objects again on this side. */
  private revive(method: string, args: unknown[]): unknown[] {
    if (method === 'register' && typeof args[1] === 'string' && Array.isArray(args[2])) {
      // assistantVocabulary.register(key, role, terms): the role is an Enum on this side.
      const role = AssistantVocabularyRole.fromValue(String(args[1]));
      if (role) return [args[0], role, args[2]];
    }
    return args.map((arg) => this.callbacks.revive(PluginHostDispatcher.reviveSql(arg)));
  }

  /** `{ $sql, params }` from the guest becomes a parametrised raw statement for `execute`/`queryRaw`. */
  private static reviveSql(arg: unknown): unknown {
    if (arg && typeof arg === 'object' && typeof (arg as any).$sql === 'string') {
      const { $sql, params } = arg as { $sql: string; params: unknown[] };
      return { toSQL: () => ({ sql: $sql, params }), $sql, params };
    }
    return arg;
  }

  /** The last value must survive structured clone: a `Response` from `fetch` is read into bytes; functions cannot cross. */
  private static async portableResult(value: unknown): Promise<unknown> {
    if (value && typeof value === 'object' && typeof (value as Response).arrayBuffer === 'function' && typeof (value as Response).status === 'number') {
      const response = value as Response;
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      return { status: response.status, statusText: response.statusText, headers, body: Buffer.from(await response.arrayBuffer()) };
    }
    if (typeof value === 'function') return undefined;
    if (value && typeof value === 'object' && typeof (value as any).value === 'string' && (value as any).constructor?.name?.endsWith?.('Enum')) return (value as any).value;
    // A raw pg result carries its type-parser closures (`getTypeParser`): only the rows are data.
    if (value && typeof value === 'object' && Array.isArray((value as any).rows) && 'command' in (value as any)) {
      const result = value as { rows: unknown[]; rowCount?: number | null; command?: string };
      return { rows: result.rows, rowCount: result.rowCount ?? null, command: result.command };
    }
    try {
      structuredClone(value);
      return value;
    } catch {
      // Something in the graph is not cloneable (a method, a class instance with closures): send the
      // plain data view of it. Functions vanish; everything a plugin can act on stays.
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }
  }
}
