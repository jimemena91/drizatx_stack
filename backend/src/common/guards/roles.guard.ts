import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import { hasAtLeastRole, normalizeRole } from '../utils/role.utils';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: AppRole | string; roles?: (AppRole | string)[] } | undefined;
    const combinedRoles: (AppRole | string | undefined)[] = [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ];

    return required.some((role) => {
      const normalizedRequired = normalizeRole(role) as Role | undefined;
      if (!normalizedRequired) return false;
      return hasAtLeastRole(combinedRoles, normalizedRequired);
    });
  }
}