import { IDatabaseManager } from '@fromcode/database';
import { Logger } from '@fromcode/sdk';
import { PluginManifest } from '../types';

/**
 * Migration Coordinator
 * Handles conflict detection and ordering of plugin migrations.
 * Ensures that if multiple plugins try to modify the same table, 
 * they do so in a predictable order based on migrationPriority.
 */
export class MigrationCoordinator {
  private logger = new Logger({ namespace: 'migration-coordinator' });
  private tableOwnership: Map<string, string> = new Map(); // Table -> Plugin Slug

  constructor(private db: IDatabaseManager) {}

  /**
   * Validates a set of plugins for potential schema conflicts
   * @param manifests - Array of plugin manifests to coordinate
   */
  async coordinate(manifests: PluginManifest[]): Promise<PluginManifest[]> {
    this.logger.info(`Coordinating migrations for ${manifests.length} plugins...`);
    
    // 1. Sort by migrationPriority (higher first or lower first? Usually 0 is high, or 100 is high)
    // Looking at roadmap: "use migrationPriority for ordering"
    // Let's assume higher number = higher priority (runs later or earlier? Usually we want core first).
    // Let's use priority 0 for core, 100 for user plugins.
    const sorted = [...manifests].sort((a, b) => {
      const pA = (a as any).migrationPriority || 100;
      const pB = (b as any).migrationPriority || 100;
      return pA - pB;
    });

    // 2. Detect conflicts (Two plugins shouldn't define the same collection unless it's a merge)
    // Note: Our PluginManager already handles collection merging, so coordinator mainly checks for raw table conflicts
    
    for (const manifest of sorted) {
      const collections = (manifest as any).collections;
      if (Array.isArray(collections)) {
        for (const table of collections) {
          if (this.tableOwnership.has(table)) {
            const owner = this.tableOwnership.get(table);
            this.logger.warn(`Potential Conflict: Table "${table}" is modified by both "${owner}" and "${manifest.slug}".`);
          }
          this.tableOwnership.set(table, manifest.slug);
        }
      }
    }

    return sorted;
  }

  /**
   * Pre-migration validation: Checks if the database is in a consistent state
   */
  async validateDatabaseState(): Promise<boolean> {
    try {
      return await this.db.tableExists('_system_meta');
    } catch (err) {
      this.logger.error('Pre-migration state check failed. System tables missing.');
      return false;
    }
  }
}
