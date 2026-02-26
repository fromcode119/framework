import { IDatabaseManager, systemLogs, systemAuditLogs, systemPlugins } from '@fromcode119/database';

export class SystemService {
  constructor(private db: IDatabaseManager) {}

  async getLogs(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const { or, and, eq, isNull, desc } = this.db;

    let whereClause = params.search ? or(
      this.db.like(systemLogs.message, `%${params.search}%`),
      this.db.like(systemLogs.pluginSlug, `%${params.search}%`)
    ) : undefined;

    const activityFilter = or(
      isNull(systemLogs.pluginSlug),
      eq(systemLogs.pluginSlug, 'system'),
      eq(systemPlugins.state, 'active')
    );
    const finalWhere = whereClause ? and(whereClause, activityFilter) : activityFilter;

    const totalDocs = await this.db.count(systemLogs, {
      joins: [{ table: systemPlugins, on: eq(systemLogs.pluginSlug, systemPlugins.slug), type: 'left' }],
      where: finalWhere
    });

    const docs = await this.db.find(systemLogs, {
      columns: {
        id: true,
        pluginSlug: true,
        level: true,
        message: true,
        context: true,
        timestamp: true
      },
      joins: [{ table: systemPlugins, on: eq(systemLogs.pluginSlug, systemPlugins.slug), type: 'left' }],
      where: finalWhere,
      orderBy: desc(systemLogs.timestamp),
      limit,
      offset
    });

    return {
      docs,
      totalDocs,
      limit,
      page,
      totalPages: Math.ceil(totalDocs / limit)
    };
  }

  async getAuditLogs(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const { or, and, eq, isNull, desc } = this.db;

    const conditions: any[] = [];
    if (params.search) {
      conditions.push(or(
        this.db.like(systemAuditLogs.resource, `%${params.search}%`),
        this.db.like(systemAuditLogs.action, `%${params.search}%`),
        this.db.like(systemAuditLogs.pluginSlug, `%${params.search}%`)
      ));
    }
    if (params.status) {
      conditions.push(eq(systemAuditLogs.status, params.status));
    }

    const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;
    const auditFilter = or(
      isNull(systemAuditLogs.pluginSlug),
      eq(systemAuditLogs.pluginSlug, 'system'),
      eq(systemPlugins.state, 'active')
    );
    const finalWhere = baseWhere ? and(baseWhere, auditFilter) : auditFilter;

    const totalDocs = await this.db.count(systemAuditLogs, {
      joins: [{ table: systemPlugins, on: eq(systemAuditLogs.pluginSlug, systemPlugins.slug), type: 'left' }],
      where: finalWhere
    });

    const docs = await this.db.find(systemAuditLogs, {
      columns: {
        id: true,
        pluginSlug: true,
        action: true,
        resource: true,
        status: true,
        metadata: true,
        createdAt: true
      },
      joins: [{ table: systemPlugins, on: eq(systemAuditLogs.pluginSlug, systemPlugins.slug), type: 'left' }],
      where: finalWhere,
      orderBy: desc(systemAuditLogs.createdAt),
      limit,
      offset
    });

    return {
      docs,
      totalDocs,
      limit,
      page,
      totalPages: Math.ceil(totalDocs / limit)
    };
  }
}
