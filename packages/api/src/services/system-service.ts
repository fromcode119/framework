import { IDatabaseManager, count, systemLogs, systemAuditLogs, systemPlugins, desc, or, ilike, eq, and, isNull } from '@fromcode119/database';

export class SystemService {
  constructor(private db: IDatabaseManager, private drizzle: any) {}

  async getLogs(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = params.search ? or(
      ilike(systemLogs.message, `%${params.search}%`),
      ilike(systemLogs.pluginSlug, `%${params.search}%`)
    ) : undefined;

    const activityFilter = or(
      isNull(systemLogs.pluginSlug),
      eq(systemLogs.pluginSlug, 'system'),
      eq(systemPlugins.state, 'active')
    );
    const finalWhere = whereClause ? and(whereClause, activityFilter) : activityFilter;

    const totalResult = await this.drizzle.select({ value: count() }).from(systemLogs)
      .leftJoin(systemPlugins, eq(systemLogs.pluginSlug, systemPlugins.slug))
      .where(finalWhere);
    const totalDocs = Number(totalResult[0]?.value || 0);

    const docs = await this.drizzle.select({
      id: systemLogs.id,
      pluginSlug: systemLogs.pluginSlug,
      level: systemLogs.level,
      message: systemLogs.message,
      context: systemLogs.context,
      timestamp: systemLogs.timestamp
    }).from(systemLogs)
      .leftJoin(systemPlugins, eq(systemLogs.pluginSlug, systemPlugins.slug))
      .where(finalWhere)
      .orderBy(desc(systemLogs.timestamp))
      .limit(limit)
      .offset(offset);

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

    const conditions: any[] = [];
    if (params.search) {
      conditions.push(or(
        ilike(systemAuditLogs.resource, `%${params.search}%`),
        ilike(systemAuditLogs.action, `%${params.search}%`),
        ilike(systemAuditLogs.pluginSlug, `%${params.search}%`)
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

    const totalResult = await this.drizzle.select({ value: count() }).from(systemAuditLogs)
      .leftJoin(systemPlugins, eq(systemAuditLogs.pluginSlug, systemPlugins.slug))
      .where(finalWhere);
    const totalDocs = Number(totalResult[0]?.value || 0);

    const docs = await this.drizzle.select({
      id: systemAuditLogs.id,
      pluginSlug: systemAuditLogs.pluginSlug,
      action: systemAuditLogs.action,
      resource: systemAuditLogs.resource,
      status: systemAuditLogs.status,
      metadata: systemAuditLogs.metadata,
      createdAt: systemAuditLogs.createdAt
    }).from(systemAuditLogs)
      .leftJoin(systemPlugins, eq(systemAuditLogs.pluginSlug, systemPlugins.slug))
      .where(finalWhere)
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      docs,
      totalDocs,
      limit,
      page,
      totalPages: Math.ceil(totalDocs / limit)
    };
  }
}
