import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '@nestjs/passport';

import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Service } from '@/entities/service.entity';

const JwtAuthGuard = AuthGuard('jwt');

describe('ServicesController permissions', () => {
  let app: INestApplication;
  let servicesService: {
    findAll: jest.Mock<Promise<Service[]>, []>;
    findActive: jest.Mock<Promise<Service[]>, []>;
  };

  beforeEach(async () => {
    servicesService = {
      findAll: jest.fn(),
      findActive: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        PermissionsGuard,
        {
          provide: ServicesService,
          useValue: servicesService as unknown as ServicesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const requestContext = context.switchToHttp().getRequest();
          requestContext.user = { permissions: ['serve_tickets'] };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows operators with serve_tickets permission to list all services', async () => {
    const service: Service = {
      id: 1,
      name: 'Service A',
      prefix: 'SA',
      nextTicketNumber: 1,
      active: true,
      priority: 1,
      estimatedTime: 10,
      maxAttentionTime: null,
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      operatorLinks: [],
      operators: [],
      systemLocked: false,
    };
    servicesService.findAll.mockResolvedValue([service]);

    const response = await request(app.getHttpServer()).get('/api/services').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 1, name: 'Service A', prefix: 'SA' }),
    ]);
    expect(servicesService.findAll).toHaveBeenCalledTimes(1);
  });

  it('allows operators with serve_tickets permission to list active services', async () => {
    const service: Service = {
      id: 2,
      name: 'Service B',
      prefix: 'SB',
      nextTicketNumber: 50,
      active: true,
      priority: 1,
      estimatedTime: 10,
      maxAttentionTime: null,
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      operatorLinks: [],
      operators: [],
      systemLocked: false,
    };
    servicesService.findActive.mockResolvedValue([service]);

    const response = await request(app.getHttpServer()).get('/api/services/active').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ id: 2, name: 'Service B', prefix: 'SB' }),
    ]);
    expect(servicesService.findActive).toHaveBeenCalledTimes(1);
  });
});
