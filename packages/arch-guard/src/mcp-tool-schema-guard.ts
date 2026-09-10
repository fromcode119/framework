import fs from 'node:fs';
import path from 'node:path';

import { FrameworkRoot } from './cli/framework-root';
import { IMcpToolSchemaViolation } from './interfaces/mcp-tool-schema-violation.interface';

/**
 * Every MCP tool literal must declare `inputSchema` and `permission`.
 *
 * A tool missing either is not exposed by `McpToolRegistry` at runtime, so without this guard it
 * would simply vanish from `tools/list` with no build-time signal — silently absent rather than
 * loudly broken, which is the failure mode this repo treats as worst.
 */
export class McpToolSchemaGuard {
  /** Files that plausibly define tools. Narrow on purpose — this is not a whole-repo scan. */
  private static readonly FILE_PATTERN = /-tools?\.ts$/;
  private static readonly TOOL_LITERAL = /tool:\s*'([a-z0-9_.-]+)'/g;
  /** How far past a `tool:` key to look for its siblings. One object literal, generously. */
  private static readonly BODY_WINDOW = 1200;

  static findViolations(file: string, source: string): IMcpToolSchemaViolation[] {
    // Keyed by tool name: a name legitimately appears several times in one file (a definition plus
    // the places it is referenced), and reporting the same missing schema five times buries the
    // other offenders rather than emphasising this one.
    // `seen` tracks EVERY name examined, not just the violating ones. A tool name appears again inside
    // its own handler's return payloads (`action: { tool: 'content.update', … }`), and those mentions
    // have no schema beside them — checking only the DEFINITION, which is the first occurrence, is the
    // whole point. Keying only violations meant a tool that passed was re-examined at every later
    // mention and then reported as missing.
    const seen = new Set<string>();
    const byTool = new Map<string, IMcpToolSchemaViolation>();
    for (const match of source.matchAll(McpToolSchemaGuard.TOOL_LITERAL)) {
      const tool = match[1];
      if (seen.has(tool)) continue;
      seen.add(tool);
      const start = match.index ?? 0;
      const body = source.slice(start, start + McpToolSchemaGuard.BODY_WINDOW);
      if (!/\binputSchema\s*:/.test(body)) {
        byTool.set(tool, { file, tool, missing: 'inputSchema' });
        continue;
      }
      if (!/\bpermission\s*:/.test(body)) {
        byTool.set(tool, { file, tool, missing: 'permission' });
      }
    }
    return [...byTool.values()];
  }

  static run(): number {
    const repo = FrameworkRoot.repo();
    const roots = [
      path.join(repo, 'framework', 'Source', 'packages'),
      path.join(repo, 'plugins'),
    ];

    const violations: IMcpToolSchemaViolation[] = [];
    for (const root of roots) {
      for (const file of McpToolSchemaGuard.walk(root)) {
        violations.push(...McpToolSchemaGuard.findViolations(file, fs.readFileSync(file, 'utf8')));
      }
    }

    if (!violations.length) {
      console.log('[check-mcp-tool-schemas] OK');
      return 0;
    }

    console.error('[check-mcp-tool-schemas] MCP tools missing a schema or permission:\n');
    for (const v of violations) console.error(`  ${v.file}: ${v.tool} is missing ${v.missing}`);
    console.error(`\n${violations.length} tool(s) would be hidden from tools/list.`);
    return 1;
  }

  private static walk(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: false });
    const found: string[] = [];
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...McpToolSchemaGuard.walk(full));
      else if (McpToolSchemaGuard.FILE_PATTERN.test(entry.name)) found.push(full);
    }
    return found;
  }
}
