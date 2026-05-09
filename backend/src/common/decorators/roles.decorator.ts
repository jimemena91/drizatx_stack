import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'SUPERADMIN' | 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'USER' | 'DISPLAY';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
