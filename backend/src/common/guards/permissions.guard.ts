import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { normalizePermissionSlug, type AppPermission, type Permission } from '../../common/enums/permission.enum';
import { Role } from '../../common/enums/role.enum';
import { normalizeRole } from '../../common/utils/role.utils';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { permissions?: string[]; role?: string; roles?: string[] } | undefined;
    const rawRoles: Array<string | Role | null | undefined> = [
      ...(Array.isArray(user?.roles) ? user?.roles : []),
      user?.role,
    ];

    const hasBypassRole = rawRoles.some((role) => {
      const normalizedRole = normalizeRole(role);
      return normalizedRole === Role.SUPERADMIN || normalizedRole === Role.ADMIN;
    });
    if (hasBypassRole) {
      return true;
    }
    const normalizedRequired = requiredPermissions
      .map((permission) => normalizePermissionSlug(permission))
      .filter((permission): permission is Permission => Boolean(permission));

    if (normalizedRequired.length === 0) {
      return true;
    }

    const userPermissions = new Set(
      (Array.isArray(user?.permissions) ? user.permissions : [])
        .map((permission) => normalizePermissionSlug(permission))
        .filter((permission): permission is Permission => Boolean(permission)),
    );

    return normalizedRequired.some((permission) => userPermissions.has(permission));
  }
}
