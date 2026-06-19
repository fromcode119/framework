import path from 'path';
import { EmailManager, EmailFactory } from '@fromcode119/email';
import { MediaManager, StorageFactory } from '@fromcode119/media';
import { CacheManager, CacheFactory } from '@fromcode119/cache';
import { Logger } from '../logging';
import { IntegrationRegistry } from './integration-registry';
import { MultiProviderEmailSender } from './multi-provider-email-sender';

type EmailSender = Pick<EmailManager, 'send'>;

/**
 * IntegrationCoreRefreshService
 *
 * Resolves and instantiates the three built-in core integrations (email, storage,
 * cache), applying the same fallback drivers on failure. Extracted from
 * IntegrationManager to keep that class under the size limit; the manager assigns
 * the returned instances to its public fields and keeps its public refresh methods.
 */
export class IntegrationCoreRefreshService {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly logger: Logger,
    private readonly projectRoot: string,
  ) {}

  async refreshEmail(preferStored: boolean): Promise<{ email: EmailSender; resolved: any }> {
    try {
      const resolvedInstances = await this.registry.instantiateMany<EmailManager>('email', {
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      if (!resolvedInstances.length) {
        throw new Error('No email providers resolved');
      }

      if (resolvedInstances.length === 1) {
        const only = resolvedInstances[0];
        this.logger.info(`Email integration active: ${only.resolved.providerKey} (${only.resolved.source})`);
        return { email: only.instance, resolved: only.resolved };
      }

      const email = new MultiProviderEmailSender(
        resolvedInstances.map((entry) => ({ key: entry.resolved.providerKey, sender: entry.instance })),
        this.logger
      );
      const providerKeys = resolvedInstances.map((entry) => entry.resolved.providerKey).join(', ');
      this.logger.info(`Email integrations active (fan-out): ${providerKeys} (stored)`);
      return { email, resolved: resolvedInstances.map((entry) => entry.resolved) };
    } catch (error: any) {
      this.logger.error(`Failed to initialize email integration: ${error.message}. Falling back to mock driver.`);
      return { email: new EmailManager(EmailFactory.create('mock', {})), resolved: null };
    }
  }

  async refreshStorage(preferStored: boolean): Promise<{ storage: MediaManager; resolved: any }> {
    try {
      const { instance, resolved } = await this.registry.instantiate<MediaManager>('storage', {
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.logger.info(`Storage integration active: ${resolved.providerKey} (${resolved.source})`);
      return { storage: instance, resolved };
    } catch (error: any) {
      this.logger.error(`Failed to initialize storage integration: ${error.message}. Falling back to default local driver.`);
      // Fallback to local driver to prevent system-wide crashes
      const uploadDir = process.env.STORAGE_UPLOAD_DIR || path.resolve(this.projectRoot, 'public/uploads');
      const publicUrl = process.env.STORAGE_PUBLIC_URL || '/uploads';
      return { storage: new MediaManager(StorageFactory.create('local', { uploadDir, publicUrlBase: publicUrl })), resolved: null };
    }
  }

  async refreshCache(preferStored: boolean): Promise<{ cache: CacheManager; resolved: any }> {
    try {
      const { instance, resolved } = await this.registry.instantiate<CacheManager>('cache', {
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.logger.info(`Cache integration active: ${resolved.providerKey} (${resolved.source})`);
      return { cache: instance, resolved };
    } catch (error: any) {
      this.logger.error(`Failed to initialize cache integration: ${error.message}. Falling back to memory driver.`);
      return { cache: new CacheManager(CacheFactory.create('memory', {})), resolved: null };
    }
  }
}
