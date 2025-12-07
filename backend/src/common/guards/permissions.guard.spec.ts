import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AppPermission } from '@/common/enums/permission.enum';
import { PermissionsGuard } from './permissions.guard';

const createContext = (user?: {
  permissions?: string[];
  role?: string;
  roles?: string[];
}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getType: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext);

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new PermissionsGuard(reflector);
  });

  it('permite el acceso cuando no se requieren permisos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const ctx = createContext({ role: 'OPERATOR' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega el acceso cuando el usuario no posee los permisos requeridos', () => {
    const required: AppPermission[] = ['manage_settings'];
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    const ctx = createContext({ permissions: ['view_dashboard'] });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('permite acceso a superadministrador sin permisos declarados', () => {
    const required: AppPermission[] = ['manage_settings'];
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    const ctx = createContext({ role: 'SUPERADMIN' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso a administrador sin permisos individuales', () => {
    const required: AppPermission[] = ['manage_settings'];
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    const ctx = createContext({ role: 'ADMIN', permissions: [] });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso a administrador presente en arreglo de roles', () => {
    const required: AppPermission[] = ['manage_settings'];
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    const ctx = createContext({ roles: ['OPERATOR', 'ADMIN'], permissions: [] });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
