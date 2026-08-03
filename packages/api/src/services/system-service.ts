import { IDatabaseManager, Schema } from '@fromcode119/database';

export class SystemService {
  constructor(private db: IDatabaseManager) {}

  async getLogs(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const { or, and, eq, isNull, desc } = this.db;

    let whereClause = params.search ? or(
      this.db.like(Schema.systemLogs.message, `%${params.search}%`),
      this.db.like(Schema.systemLogs.pluginSlug, `%${params.search}%`)
    ) : undefined;

    const activityFilter = or(
      isNull(Schema.systemLogs.pluginSlug),
      eq(Schema.systemLogs.pluginSlug, 'system'),
      eq(Schema.systemPlugins.state, 'active')
    );
    const finalWhere = whereClause ? and(whereClause, activityFilter) : activityFilter;

    const totalDocs = await this.db.count(Schema.systemLogs, {
      joins: [{ table: Schema.systemPlugins, on: eq(Schema.systemLogs.pluginSlug, Schema.systemPlugins.slug), type: 'left' }],
      where: finalWhere
    });

    const docs = await this.db.find(Schema.systemLogs, {
      columns: {
        id: true,
        pluginSlug: true,
        level: true,
        message: true,
        context: true,
        timestamp: true
      },
      joins: [{ table: Schema.systemPlugins, on: eq(Schema.systemLogs.pluginSlug, Schema.systemPlugins.slug), type: 'left' }],
      where: finalWhere,
      orderBy: desc(Schema.systemLogs.timestamp),
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
        this.db.like(Schema.systemAuditLogs.resource, `%${params.search}%`),
        this.db.like(Schema.systemAuditLogs.action, `%${params.search}%`),
        this.db.like(Schema.systemAuditLogs.pluginSlug, `%${params.search}%`)
      ));
    }
    if (params.status) {
      conditions.push(eq(Schema.systemAuditLogs.status, params.status));
    }

    const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;
    const auditFilter = or(
      isNull(Schema.systemAuditLogs.pluginSlug),
      eq(Schema.systemAuditLogs.pluginSlug, 'system'),
      eq(Schema.systemPlugins.state, 'active')
    );
    const finalWhere = baseWhere ? and(baseWhere, auditFilter) : auditFilter;

    const totalDocs = await this.db.count(Schema.systemAuditLogs, {
      joins: [{ table: Schema.systemPlugins, on: eq(Schema.systemAuditLogs.pluginSlug, Schema.systemPlugins.slug), type: 'left' }],
      where: finalWhere
    });

    const docs = await this.db.find(Schema.systemAuditLogs, {
      columns: {
        id: true,
        pluginSlug: true,
        action: true,
        resource: true,
        status: true,
        metadata: true,
        createdAt: true
      },
      joins: [{ table: Schema.systemPlugins, on: eq(Schema.systemAuditLogs.pluginSlug, Schema.systemPlugins.slug), type: 'left' }],
      where: finalWhere,
      orderBy: desc(Schema.systemAuditLogs.createdAt),
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