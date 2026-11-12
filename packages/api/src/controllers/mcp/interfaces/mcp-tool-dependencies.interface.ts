import type { MediaManager } from '@fromcode119/media';
import type { PeopleManagementService } from '@api/services/people-management-service';

/** What framework MCP tools need from the running server. */
export interface IMcpToolDependencies {
  db: any;
  /** The people directory as the admin's Users → People screen runs it. */
  people: Pick<PeopleManagementService, 'getPeople' | 'getPerson' | 'savePerson'>;
  mediaManager: MediaManager;
  /** Live operator settings; MCP media limits change without restarting the API. */
  settingsCache: Map<string, string>;
  /** The plugin manager's hook bus — cache.purge fires the framework purge event through it. */
  hooks: { call: (event: string, payload: Record<string, unknown>) => Promise<unknown> };
  /** Server logger — deploy.restart announces who asked before the process exits. */
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}
