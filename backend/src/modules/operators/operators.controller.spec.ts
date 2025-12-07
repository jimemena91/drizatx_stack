import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';

describe('OperatorsController access control', () => {
  let controller: OperatorsController;
  let service: jest.Mocked<OperatorsService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [OperatorsController],
      providers: [
        {
          provide: OperatorsService,
          useValue: {
            findAllWithStatus: jest.fn(),
            findOne: jest.fn(),
            getServicesForOperator: jest.fn(),
            getAttentionMetrics: jest.fn(),
            callNextByService: jest.fn(),
            replaceServices: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            adminUpdatePassword: jest.fn(),
            findActive: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(OperatorsController);
    service = moduleRef.get(OperatorsService) as jest.Mocked<OperatorsService>;
  });

  it('permite a un operador leer su propio perfil', async () => {
    const req: any = { user: { role: 'OPERATOR', sub: 5 } };
    const operator = { id: 5, name: 'Operador 5' } as any;
    service.findOne.mockResolvedValue(operator);

    await expect(controller.findOne(5, req)).resolves.toBe(operator);
    expect(service.findOne).toHaveBeenCalledWith(5);
  });

  it('impide que un operador lea el perfil de otro operador', async () => {
    const req: any = { user: { role: 'OPERATOR', sub: 2 } };

    await expect(controller.findOne(7, req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('permite que un supervisor lea perfiles ajenos', async () => {
    const req: any = { user: { role: 'SUPERVISOR', sub: 1 } };
    const operator = { id: 7, name: 'Operador 7' } as any;
    service.findOne.mockResolvedValue(operator);

    await expect(controller.findOne(7, req)).resolves.toBe(operator);
    expect(service.findOne).toHaveBeenCalledWith(7);
  });

  it('permite que un administrador lea perfiles ajenos', async () => {
    const req: any = { user: { role: 'ADMIN', sub: 1 } };
    const operator = { id: 8, name: 'Operador 8' } as any;
    service.findOne.mockResolvedValue(operator);

    await expect(controller.findOne(8, req)).resolves.toBe(operator);
    expect(service.findOne).toHaveBeenCalledWith(8);
  });
});
