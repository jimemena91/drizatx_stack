// backend/src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';

import { Operator } from '../../entities/operator.entity';
import { LoginDto } from './dto/login.dto';
import { Role } from '../../common/enums/role.enum';
import { Permission as PermissionEnum } from '../../common/enums/permission.enum';
import { Permission as PermissionEntity } from '../../entities/permission.entity';
import { resolveHighestRole, uniqueNormalizedRoles, sortRolesByRankDesc } from '../../common/utils/role.utils';
import { AuditLogsService } from '../../modules/audit/audit-logs.service';

// ========== Auditoría opcional (plug & play) ==========
export interface AuthAuditEvent {
  type:
    | 'AUTH_LOGIN_SUCCESS'
    | 'AUTH_LOGIN_FAILURE'
    | 'AUTH_DEV_BYPASS'
    | 'AUTH_LOGOUT'
    | 'AUTH_TOKEN_REFRESH';
  operatorId?: number | null;
  identifier?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, any>;
  at?: Date;
}
export interface IAuditTrail {
  record(evt: AuthAuditEvent): Promise<void> | void;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepo: Repository<PermissionEntity>,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(AuditLogsService)
    private readonly audit?: IAuditTrail, // no es obligatorio inyectarlo
  ) {}

  private readonly operatorRelations = {
    operatorRoles: { role: { rolePermissions: { permission: true } } },
  } as const;

  private collectRoleSlugs(user: Operator): Role[] {
    const slugs = user.operatorRoles?.map((link) => link.role?.slug) ?? [];
    return uniqueNormalizedRoles(slugs);
  }

  private async getAllPermissionSlugs(): Promise<PermissionEnum[]> {
    const permissions = await this.permissionsRepo.find({ select: ['slug'], order: { slug: 'ASC' } });
    if (!permissions.length) {
      return Object.values(PermissionEnum).sort();
    }
    return permissions.map((permission) => permission.slug as PermissionEnum);
  }

  private async collectPermissionSlugs(user: Operator): Promise<PermissionEnum[]> {
    const roleSlugs = this.collectRoleSlugs(user);
    if (roleSlugs.includes(Role.SUPERADMIN) || roleSlugs.includes(Role.ADMIN)) {
      return this.getAllPermissionSlugs();
    }

    const permissions = new Set<PermissionEnum>();
    for (const link of user.operatorRoles ?? []) {
      for (const rolePermission of link.role?.rolePermissions ?? []) {
        const slug = rolePermission.permission?.slug;
        if (slug) permissions.add(slug as PermissionEnum);
      }
    }
    return Array.from(permissions).sort();
  }

  private async buildSafeUser(user: Operator) {
    const roles = sortRolesByRankDesc(this.collectRoleSlugs(user));
    const permissions = await this.collectPermissionSlugs(user);
    const primaryRole = resolveHighestRole(roles) ?? Role.OPERATOR;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: primaryRole,
      roles,
      permissions,
      position: user.position,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ========= Utils / flags =========
  private isDevBypass(): boolean {
    return (process.env.AUTH_DEV_BYPASS ?? '').toLowerCase() === 'true';
  }

  private async auditRecord(evt: AuthAuditEvent) {
    const event: AuthAuditEvent = { at: new Date(), ...evt };
    // log estructurado (sirve si enviás a Loki/ELK)
    this.logger.log(`[AUDIT] ${event.type} ${JSON.stringify(event)}`);
    // si tenés un servicio de auditoría, se llama aquí
    if (this.audit?.record) {
      try {
        await this.audit.record(event);
      } catch (e) {
        this.logger.warn(`[AUDIT] record() failed: ${(e as any)?.message}`);
      }
    }
  }

  private normalize(dto: LoginDto): { identifier: string; password: string } {
    const identifier = (dto.username?.trim() || dto.email?.trim() || '').toLowerCase();
    const password = dto.password?.trim() || '';
    return { identifier, password };
  }

  /**
   * Busca por username o email (TRIM + LOWER) y TRAE passwordHash
   * aunque la entidad lo tenga con select:false.
   */
  private async findUserForLogin(identifier: string): Promise<Operator | null> {
    if (!identifier) return null;
    return this.operatorsRepo
      .createQueryBuilder('op')
      .addSelect('op.passwordHash') // clave: trae hash pese a select:false
      .leftJoinAndSelect('op.operatorRoles', 'operatorRoles')
      .leftJoinAndSelect('operatorRoles.role', 'role')
      .leftJoinAndSelect('role.rolePermissions', 'rolePermissions')
      .leftJoinAndSelect('rolePermissions.permission', 'permission')
      .where('LOWER(TRIM(op.username)) = :id', { id: identifier })
      .orWhere('LOWER(TRIM(op.email)) = :id', { id: identifier })
      .limit(1)
      .getOne();
  }

  // ========= API pública =========
  async login(dto: LoginDto, ctx?: { ip?: string; userAgent?: string }) {
    const { identifier, password } = this.normalize(dto);
    if (!identifier || !password) {
      throw new BadRequestException('Debes enviar email o username, y password.');
    }

    // DEV BYPASS: útil solo en entornos de desarrollo
    if (this.isDevBypass()) {
      const user =
        (await this.operatorsRepo.findOne({
          where: [{ username: identifier }, { email: identifier }],
          relations: this.operatorRelations,
        })) || null;

      if (!user) {
        await this.auditRecord({
          type: 'AUTH_DEV_BYPASS',
          identifier,
          operatorId: null,
          meta: { found: false },
        });
        throw new UnauthorizedException('Credenciales incorrectas');
      }
      const safeUser = await this.buildSafeUser(user);
      if (user.active === false) {
        await this.auditRecord({
          type: 'AUTH_LOGIN_FAILURE',
          identifier,
          operatorId: user.id,
          meta: { reason: 'inactive', role: safeUser.role, roles: safeUser.roles },
        });
        throw new ForbiddenException('Usuario inactivo');
      }

      await this.auditRecord({
        type: 'AUTH_DEV_BYPASS',
        identifier,
        operatorId: user.id,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        meta: { role: safeUser.role, roles: safeUser.roles },
      });

      return this.issueToken(user);
    }

    // Camino normal
    const user = await this.findUserForLogin(identifier);
    const safeUser = user ? await this.buildSafeUser(user) : null;
    if (!user?.passwordHash) {
      await this.auditRecord({
        type: 'AUTH_LOGIN_FAILURE',
        identifier,
        operatorId: user?.id ?? null,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        meta: {
          reason: user ? 'no_hash' : 'not_found',
          role: safeUser?.role,
          roles: safeUser?.roles ?? [],
        },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.active === false) {
      await this.auditRecord({
        type: 'AUTH_LOGIN_FAILURE',
        identifier,
        operatorId: user.id,
        meta: { reason: 'inactive', role: safeUser?.role, roles: safeUser?.roles ?? [] },
      });
      throw new ForbiddenException('Usuario inactivo');
    }

    const ok = await bcrypt.compare(password, String(user.passwordHash));
    if (!ok) {
      await this.auditRecord({
        type: 'AUTH_LOGIN_FAILURE',
        identifier,
        operatorId: user.id,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        meta: { reason: 'bad_password', role: safeUser?.role, roles: safeUser?.roles ?? [] },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    await this.auditRecord({
      type: 'AUTH_LOGIN_SUCCESS',
      identifier,
      operatorId: user.id,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      meta: { role: safeUser?.role, roles: safeUser?.roles ?? [] },
    });

    return this.issueToken(user);
  }

  async profile(operatorId: number) {
    const user = await this.operatorsRepo.findOne({
      where: { id: operatorId },
      relations: this.operatorRelations,
    });
    if (!user) throw new UnauthorizedException();
    return this.buildSafeUser(user);
  }

  async myPermissions(operatorId: number) {
    const user = await this.profile(operatorId);
    return {
      role: user.role,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  /** (Opcional) Logout lógico si luego manejás tokenVersion/blacklist */
  async logout(operatorId: number) {
    await this.auditRecord({ type: 'AUTH_LOGOUT', operatorId });
    return { ok: true };
  }

  // ========= Helpers =========
  private async issueToken(user: Operator) {
    // Nunca exponer el hash
    delete (user as any).passwordHash;

    const safeUser = await this.buildSafeUser(user);

    const payload = {
      sub: user.id,
      username: user.username,
      role: safeUser.role,
      roles: safeUser.roles,
      permissions: safeUser.permissions,
      name: user.name,
      // tokenVersion: user.tokenVersion ?? 0, // si luego lo implementás
    };

    // Unificación de lógica de expiración
    const expiresIn = this.resolveJwtExpiresIn(process.env.JWT_EXPIRES_IN);
    const access_token = await this.jwtService.signAsync(payload, { expiresIn } as JwtSignOptions);

    return { access_token, token: access_token, user: safeUser };
  }

  /**
   * Normaliza JWT_EXPIRES_IN:
   * - Si está vacío -> '8h'
   * - Si es numérico (p.ej. '3600') -> number
   * - Si es texto (p.ej. '8h', '2d') -> string
   */
  private resolveJwtExpiresIn(rawValue?: string): string | number {
    const fallback = '8h';
    if (!rawValue) return fallback;

    const trimmed = rawValue.trim();
    if (!trimmed) return fallback;

    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? trimmed : numeric;
  }
}
