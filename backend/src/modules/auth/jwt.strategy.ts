import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Operator } from '../../entities/operator.entity';
import { Role as RoleEntity } from '../../entities/role.entity';
import { OperatorRole } from '../../entities/operator-role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { Permission as PermissionEntity } from '../../entities/permission.entity';

import { Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { resolveHighestRole, normalizeRole } from '../../common/utils/role.utils';

/**
 * NOTA: Hidratamos el usuario con permisos "efectivos" calculados en runtime.
 * - Roles del usuario -> permisos por rol (role_permission)
 * - Opcionalmente, permisos directos si existieran en el payload (se fusionan)
 * - Si el rol más alto es OPERATOR, garantizamos "serve_tickets"
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(Operator) private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(RoleEntity) private readonly rolesRepo: Repository<RoleEntity>,
    @InjectRepository(OperatorRole) private readonly operatorRolesRepo: Repository<OperatorRole>,
    @InjectRepository(RolePermission) private readonly rolePermRepo: Repository<RolePermission>,
    @InjectRepository(PermissionEntity) private readonly permRepo: Repository<PermissionEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const userId: number | undefined =
      typeof payload?.sub === 'number' ? payload.sub :
      payload?.sub ? Number(payload.sub) : undefined;

    // Fallback seguro si no hay sub
    if (!userId || !Number.isFinite(userId)) {
      return {
        userId: payload?.sub,
        sub: payload?.sub,
        username: payload?.username,
        role: normalizeRole(payload?.role),
        roles: Array.isArray(payload?.roles) ? payload.roles : [],
        permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
        name: payload?.name,
      };
    }

    // 1) Traer roles del operador (OperatorRole -> Role)
    const operatorRoles = await this.operatorRolesRepo.find({
      where: { operatorId: userId },
      relations: ['role'],
    });

    const roles: string[] = operatorRoles
      .map(or => or.role?.slug || or.role?.name)
      .filter(Boolean)
      .map(String);

    // Asegurar también el rol "principal" del payload si vino
    if (payload?.role) roles.push(String(payload.role));
    if (Array.isArray(payload?.roles)) roles.push(...payload.roles.map((r: any) => String(r)));

    // Rol más alto (para lógicas de bypass u otorgar base perms)
    const highest = resolveHighestRole(roles);

    // 2) Permisos por rol
    let rolePermissions: string[] = [];
    if (roles.length > 0) {
      // buscar roles existentes por slug/name
      const roleEntities = await this.rolesRepo.find({
        where: [{ slug: In(roles) }, { name: In(roles) }],
      });
      const roleIds = roleEntities.map(r => r.id);

      if (roleIds.length > 0) {
        const rps = await this.rolePermRepo.find({
          where: { roleId: In(roleIds) },
          relations: ['permission'],
        });
        rolePermissions = rps
          .map(rp => rp.permission?.slug || rp.permission?.name)
          .filter(Boolean)
          .map(String);
      }
    }

    // 3) Fusionar con permisos del payload (si vinieran)
    const payloadPerms = Array.isArray(payload?.permissions) ? payload.permissions.map((p: any) => String(p)) : [];
    const merged = new Set<string>([...rolePermissions, ...payloadPerms]);

    // 4) Garantía de permiso base para operadores
    //    El controlador protege endpoints de operador con @Permissions(SERVE_TICKETS),
    //    así que si el rol más alto es OPERATOR, lo incluimos.
    if (highest === Role.OPERATOR) {
      merged.add(Permission.SERVE_TICKETS); // <- clave para evitar 403 en /operators/:id/*
    }

    // Opcional: si querés que SUPERVISOR también sirva tickets:
    // if (highest === Role.SUPERVISOR) merged.add(Permission.SERVE_TICKETS);

    // 5) Normalizar rol principal
    const primaryRole = normalizeRole(highest) ?? Role.OPERATOR;

    return {
      userId,
      sub: userId,
      username: payload?.username,
      role: primaryRole,
      roles: Array.from(new Set(roles)),
      permissions: Array.from(merged),
      name: payload?.name,
    };
  }
}
