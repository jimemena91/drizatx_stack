import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import {
  AuditLog,
  AuditLogActorSnapshot,
  AuditLogChange,
  AuditLogSeverity,
} from '../../entities/audit-log.entity';
import { Operator } from '../../entities/operator.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import type { AuthAuditEvent } from '../../modules/auth/auth.service';
import {
  resolveHighestRole,
  sortRolesByRankDesc,
  uniqueNormalizedRoles,
} from '../../common/utils/role.utils';

export type AuditLogResponse = {
  id: number;
  eventType: string;
  action: string;
  target: string | null;
  description: string | null;
  severity: AuditLogSeverity;
  timestamp: string;
  ip: string | null;
  source: string | null;
  tags: string[];
  changes: AuditLogChange[];
  metadata: Record<string, any> | null;
  actor: {
    id: number | null;
    name: string | null;
    username?: string | null;
    email?: string | null;
    role?: string | null;
    roles?: string[] | null;
  } | null;
};

export type AuditLogMeta = {
  page: number;
  limit: number;
  total: number;
  filtered: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  severityTotals: Record<AuditLogSeverity, number>;
  severityTotalsAll: Record<AuditLogSeverity, number>;
  actorTotals: { total: number; filtered: number };
};

export type AuditLogList = {
  data: AuditLogResponse[];
  meta: AuditLogMeta;
};

type TotalsSnapshot = {
  count: number;
  countBySeverity: Record<AuditLogSeverity, number>;
  distinctActors: number;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
  ) {}

  async list(query: AuditLogQueryDto): Promise<AuditLogList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const baseQb = this.auditRepo.createQueryBuilder('log');

    const totalsAll = await this.collectTotals(baseQb.clone());

    const filteredQb = baseQb.clone();
    this.applyFilters(filteredQb, query);

    const filteredTotals = await this.collectTotals(filteredQb.clone());

    const dataQb = this.auditRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .orderBy('log.createdAt', 'DESC');
    this.applyFilters(dataQb, query);

    const [items, filteredCount] = await Promise.all([
      dataQb.skip((page - 1) * limit).take(limit).getMany(),
      filteredQb.getCount(),
    ]);

    const pageCount = filteredCount === 0 ? 1 : Math.ceil(filteredCount / limit);

    return {
      data: items.map((item) => this.toResponse(item)),
      meta: {
        page,
        limit,
        total: totalsAll.count,
        filtered: filteredCount,
        pageCount,
        hasNext: page < pageCount,
        hasPrevious: page > 1 && pageCount > 0,
        severityTotals: filteredTotals.countBySeverity,
        severityTotalsAll: totalsAll.countBySeverity,
        actorTotals: {
          total: totalsAll.distinctActors,
          filtered: filteredTotals.distinctActors,
        },
      },
    };
  }

  async record(event: AuthAuditEvent): Promise<void> {
    try {
      const actorSnapshot = await this.resolveActorSnapshot(event);
      const log = this.auditRepo.create({
        eventType: event.type,
        action: event.type,
        target: 'Autenticación',
        description: this.describeAuthEvent(event, actorSnapshot),
        severity: this.resolveSeverity(event),
        actorId: actorSnapshot?.id ?? null,
        actorName: this.resolveActorName(actorSnapshot, event.identifier),
        actorRole: actorSnapshot?.primaryRole ?? null,
        actorSnapshot,
        ip: event.ip ?? null,
        source: this.resolveSource(event.userAgent),
        tags: ['auth'],
        changes: null,
        metadata: {
          identifier: event.identifier ?? null,
          userAgent: event.userAgent ?? null,
          ...event.meta,
        },
        createdAt: event.at ?? new Date(),
      });

      await this.auditRepo.save(log);
    } catch (error) {
      this.logger.warn(`Failed to record audit event: ${(error as any)?.message}`);
    }
  }

  private applyFilters(qb: SelectQueryBuilder<AuditLog>, filters: AuditLogQueryDto) {
    if (filters.severity) {
      qb.andWhere('log.severity = :severity', { severity: filters.severity });
    }

    if (filters.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: filters.actorId });
    }

    if (filters.search) {
      const normalized = filters.search.trim().toLowerCase();
      if (normalized.length > 0) {
        const like = `%${normalized}%`;
        qb.andWhere(
          `(
            LOWER(log.action) LIKE :query
            OR LOWER(log.description) LIKE :query
            OR LOWER(log.target) LIKE :query
            OR LOWER(log.source) LIKE :query
            OR LOWER(log.ip) LIKE :query
            OR LOWER(log.actorName) LIKE :query
            OR LOWER(log.actorRole) LIKE :query
          )`,
          { query: like },
        );
      }
    }

    if (filters.from) {
      const fromDate = new Date(filters.from);
      if (!Number.isNaN(fromDate.getTime())) {
        qb.andWhere('log.createdAt >= :from', { from: fromDate.toISOString() });
      }
    }

    if (filters.to) {
      const toDate = new Date(filters.to);
      if (!Number.isNaN(toDate.getTime())) {
        qb.andWhere('log.createdAt <= :to', { to: toDate.toISOString() });
      }
    }
  }

  private emptySeverityMap(): Record<AuditLogSeverity, number> {
    return {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
  }

  private async collectTotals(qb: SelectQueryBuilder<AuditLog>): Promise<TotalsSnapshot> {
    const count = await qb.clone().getCount();

    const rawSeverity = await qb
      .clone()
      .select('log.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.severity')
      .getRawMany<{ severity: AuditLogSeverity; count: string }>();

    const countBySeverity = this.emptySeverityMap();
    for (const row of rawSeverity) {
      const severity = row.severity;
      const parsed = Number(row.count ?? 0);
      if (severity && severity in countBySeverity && Number.isFinite(parsed)) {
        countBySeverity[severity] = parsed;
      }
    }

    const rawActors = await qb
      .clone()
      .select('COUNT(DISTINCT log.actorId)', 'count')
      .getRawOne<{ count?: string }>();

    const distinctActors = Number(rawActors?.count ?? 0) || 0;

    return { count, countBySeverity, distinctActors };
  }

  private toResponse(log: AuditLog): AuditLogResponse {
    const actor = this.resolveActorFromLog(log);

    return {
      id: log.id,
      eventType: log.eventType,
      action: log.action,
      target: log.target ?? null,
      description: log.description ?? null,
      severity: log.severity,
      timestamp: log.createdAt.toISOString(),
      ip: log.ip ?? null,
      source: log.source ?? null,
      tags: Array.isArray(log.tags) ? log.tags : [],
      changes: Array.isArray(log.changes) ? log.changes : [],
      metadata: log.metadata ?? null,
      actor,
    };
  }

  private resolveActorFromLog(log: AuditLog): AuditLogResponse['actor'] {
    if (log.actor) {
      const roles = log.actorSnapshot?.roles ?? null;
      return {
        id: log.actor.id,
        name: log.actor.name,
        username: log.actor.username,
        email: log.actor.email,
        role: (log.actorSnapshot?.primaryRole ?? log.actorRole) ?? null,
        roles: Array.isArray(roles) ? roles : log.actorRole ? [log.actorRole] : null,
      };
    }

    if (log.actorSnapshot) {
      const snapshot = log.actorSnapshot as AuditLogActorSnapshot;
      return {
        id: snapshot.id ?? log.actorId ?? null,
        name: snapshot.name ?? log.actorName ?? snapshot.identifier ?? null,
        username: snapshot.username ?? null,
        email: snapshot.email ?? null,
        role: snapshot.primaryRole ?? log.actorRole ?? null,
        roles: snapshot.roles ?? (log.actorRole ? [log.actorRole] : null),
      };
    }

    if (log.actorId || log.actorName) {
      return {
        id: log.actorId ?? null,
        name: log.actorName ?? null,
        role: log.actorRole ?? null,
      };
    }

    return null;
  }

  private async resolveActorSnapshot(event: AuthAuditEvent): Promise<AuditLogActorSnapshot | null> {
    if (!event.operatorId) {
      if (!event.identifier) return null;
      return { identifier: event.identifier };
    }

    const operator = await this.operatorsRepo.findOne({
      where: { id: event.operatorId },
      relations: {
        operatorRoles: { role: true },
      },
    });

    if (!operator) {
      return {
        id: event.operatorId,
        identifier: event.identifier ?? null,
      };
    }

    const roleSlugs = uniqueNormalizedRoles(
      operator.operatorRoles?.map((link) => link.role?.slug) ?? [],
    );
    const sortedRoles = sortRolesByRankDesc(roleSlugs);
    const primaryRole = resolveHighestRole(sortedRoles) ?? null;

    return {
      id: operator.id,
      name: operator.name,
      username: operator.username,
      email: operator.email,
      roles: sortedRoles,
      primaryRole,
      identifier: event.identifier ?? operator.email ?? operator.username ?? null,
    };
  }

  private resolveSeverity(event: AuthAuditEvent): AuditLogSeverity {
    switch (event.type) {
      case 'AUTH_LOGIN_FAILURE':
        return 'high';
      case 'AUTH_DEV_BYPASS':
        return 'medium';
      case 'AUTH_LOGIN_SUCCESS':
      case 'AUTH_LOGOUT':
      case 'AUTH_TOKEN_REFRESH':
      default:
        return 'low';
    }
  }

  private resolveSource(userAgent?: string | null): string | null {
    if (!userAgent) return 'Sistema';

    const agent = userAgent.toLowerCase();
    if (agent.includes('postman')) return 'Postman / API';
    if (agent.includes('mozilla') || agent.includes('chrome') || agent.includes('safari')) {
      return 'Panel web';
    }
    if (agent.includes('curl')) return 'CLI';
    return 'Sistema';
  }

  private resolveActorName(
    snapshot: AuditLogActorSnapshot | null,
    identifier: string | null | undefined,
  ): string | null {
    if (snapshot?.name) return snapshot.name;
    if (identifier) return identifier;
    if (snapshot?.identifier) return snapshot.identifier;
    return null;
  }

  private describeAuthEvent(
    event: AuthAuditEvent,
    snapshot: AuditLogActorSnapshot | null,
  ): string {
    const identifier = snapshot?.name ?? snapshot?.identifier ?? event.identifier ?? 'usuario';

    switch (event.type) {
      case 'AUTH_LOGIN_SUCCESS':
        return `Inicio de sesión exitoso para ${identifier}.`;
      case 'AUTH_LOGIN_FAILURE':
        return `Intento de inicio de sesión fallido para ${identifier}.`;
      case 'AUTH_DEV_BYPASS':
        return `Bypass de autenticación de desarrollo utilizado por ${identifier}.`;
      case 'AUTH_LOGOUT':
        return `Cierre de sesión registrado para ${identifier}.`;
      case 'AUTH_TOKEN_REFRESH':
        return `Renovación de token de sesión para ${identifier}.`;
      default:
        return `${event.type} registrado.`;
    }
  }
}
