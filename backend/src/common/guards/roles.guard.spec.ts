import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppRole } from '../decorators/roles.decorator'; // Importación de 'develop'
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  // Usa AppRole o string para cubrir roles tipados y la prueba de normalización
  const createContext = (user?: { role?: AppRole | string; roles?: (AppRole | string)[] }): ExecutionContext =>
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

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('permite el acceso cuando no se requiere rol', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const ctx = createContext({ role: 'OPERATOR' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega cuando el usuario no tiene rol', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['OPERATOR']);

    const ctx = createContext();

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('permite jerarquía de supervisor sobre operador', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['OPERATOR', 'SUPERVISOR']);

    const ctx = createContext({ role: 'SUPERVISOR' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite jerarquía de admin sobre supervisor', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['SUPERVISOR', 'ADMIN']);

    const ctx = createContext({ role: 'ADMIN' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deniega cuando el operador no está incluido en los roles requeridos', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['SUPERVISOR', 'ADMIN']);

    const ctx = createContext({ role: 'OPERATOR' });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  // Prueba de la rama 'codex/refactor-roles.guard.ts-for-role-validation-pp8c2g'
  it('normaliza roles en minúsculas provenientes del JWT o la base de datos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['OPERATOR']);

    const ctx = createContext({ role: 'operator' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso cuando el rol viene en el array roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    const ctx = createContext({ roles: ['ADMIN'] });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});