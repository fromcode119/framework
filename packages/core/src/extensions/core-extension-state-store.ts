import { Logger } from '../logging';
import { SystemConstants } from '../constants';
import { IDatabaseManager } from '@fromcode119/database';
import { CoreExtensionState } from './types';

/**
 * CoreExtensionStateStore
 *
 * Owns the persisted enabled/disabled state for core extensions: loads it from
 * the system meta table, applies updates, and answers the default-enabled policy.
 * Extracted from CoreExtensionManager to keep that class under the size limit;
 * the manager holds one instance and reads/writes state through it.
 */
export class CoreExtensionStateStore {
  private states: Map<string, CoreExtensionState> = new Map();

  constructor(
    private db: IDatabaseManager,
    private logger: Logger,
  ) {}

  public get(slug: string): CoreExtensionState | undefined {
    return this.states.get(slug);
  }

  /**
   * Load extension states from database
   */
  public async loadStates(): Promise<void> {
    try {
      const rows = await this.db.find(
        SystemConstants.TABLE.META,
        { where: { group: 'core-extension-state' } }
      );

      for (const row of rows) {
        try {
          const state: CoreExtensionState = JSON.parse(row.value);
          this.states.set(state.slug, state);
        } catch (error) {
          this.logger.error(`Failed to parse state for ${row.key}:`, error);
        }
      }

    } catch (error) {
      // Table might not exist yet, that's okay
      this.logger.warn('Could not load extension states:', error);
    }
  }

  /**
   * Update extension state in database
   */
  public async updateExtensionState(
    slug: string,
    updates: Partial<CoreExtensionState>
  ): Promise<void> {
    const currentState = this.states.get(slug) || {
      slug,
      enabled: false,
    };

    const newState: CoreExtensionState = {
      ...currentState,
      ...updates,
      updatedAt: new Date(),
    };

    this.states.set(slug, newState);

    try {
      await this.db.upsert(
        SystemConstants.TABLE.META,
        {
          group: 'core-extension-state',
          key: `extension.${slug}`,
          value: JSON.stringify(newState),
        },
        {
          target: ['group', 'key'],
          set: {
            value: JSON.stringify(newState),
          },
        }
      );
    } catch (error) {
      this.logger.error(`Failed to save state for ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Check if extension should be enabled by default
   */
  public isEnabledByDefault(slug: string): boolean {
    // Check environment variable first
    const envVar = `${slug.toUpperCase().replace(/-/g, '_')}_ENABLED`;
    const envValue = process.env[envVar];

    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }

    // Default to true for backwards compatibility during migration
    return true;
  }
}
