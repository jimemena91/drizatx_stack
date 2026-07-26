import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, getMetadataArgsStorage } from "typeorm";
import request from "supertest";
import { AuthGuard } from "@nestjs/passport";

import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { ServicesService } from "@/modules/services/services.service";
import { ClientsService } from "@/modules/clients/clients.service";
import { Ticket } from "@/entities/ticket.entity";
import { Service as ServiceEntity } from "@/entities/service.entity";
import { Client } from "@/entities/client.entity";
import { Operator } from "@/entities/operator.entity";
import { OperatorService } from "@/entities/operator-service.entity";
import { OperatorRole } from "@/entities/operator-role.entity";
import { OperatorShift } from "@/entities/operator-shift.entity";
import { OperatorAvailability } from "@/entities/operator-availability.entity";
import { Role } from "@/entities/role.entity";
import { RolePermission } from "@/entities/role-permission.entity";
import { Permission } from "@/entities/permission.entity";
import { AuditLog } from "@/entities/audit-log.entity";
import { QueueEventsService } from "@/modules/queue-events/queue-events.service";
import { MetricsPolicyService } from "@/modules/metrics-policy/metrics-policy.service";
import { SystemSettingsService } from "@/modules/system-settings/system-settings.service";
import { PermissionsGuard } from "@/common/guards/permissions.guard";

const JwtAuthGuard = AuthGuard("jwt");

const ENTITIES = [
  Ticket,
  ServiceEntity,
  Client,
  Operator,
  OperatorService,
  OperatorRole,
  OperatorShift,
  OperatorAvailability,
  Role,
  RolePermission,
  Permission,
  AuditLog,
];

const adaptEntityColumnsForSqlite = () => {
  const entityTargets = new Set<unknown>(ENTITIES);

  for (const column of getMetadataArgsStorage().columns) {
    if (!entityTargets.has(column.target)) {
      continue;
    }

    if (column.options.type === "timestamp") {
      column.options.type = "datetime";
    }

    if (column.options.type === "enum") {
      column.options.type = "simple-enum";
    }

    if (column.options.precision !== undefined) {
      delete column.options.precision;
    }

    if (column.options.onUpdate !== undefined) {
      delete column.options.onUpdate;
    }

    if (typeof column.options.default === "function") {
      const originalDefault = column.options.default;
      const resolvedDefault = originalDefault();

      if (
        typeof resolvedDefault === "string" &&
        /^CURRENT_TIMESTAMP\(\d+\)$/i.test(resolvedDefault.trim())
      ) {
        column.options.default = () => "CURRENT_TIMESTAMP";
      }
    }

    if (
      typeof column.options.default === "string" &&
      /^CURRENT_TIMESTAMP\(\d+\)$/i.test(column.options.default.trim())
    ) {
      column.options.default = () => "CURRENT_TIMESTAMP";
    }
  }
};

describe("TicketsController (HTTP)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let servicesService: ServicesService;
  let clientsService: ClientsService;
  let ticketsService: TicketsService;
  let systemSettingsService: SystemSettingsService;

  beforeAll(async () => {
    adaptEntityColumnsForSqlite();
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "sqlite",
          retryAttempts: 0,
          database: ":memory:",
          dropSchema: true,
          entities: ENTITIES,
          synchronize: true,
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      controllers: [TicketsController],
      providers: [
        TicketsService,
        ServicesService,
        ClientsService,
        {
          provide: SystemSettingsService,
          useValue: {
            find: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: QueueEventsService,
          useValue: new Proxy(
            {},
            {
              get: (_target, property) =>
                property === "then" ? undefined : jest.fn(),
            },
          ),
        },
        MetricsPolicyService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const requestContext = context.switchToHttp().getRequest();
          requestContext.user = {
            id: 1,
            role: "ADMIN",
            permissions: ["serve_tickets"],
          };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    dataSource = moduleRef.get(DataSource);
    servicesService = moduleRef.get(ServicesService);
    clientsService = moduleRef.get(ClientsService);
    ticketsService = moduleRef.get(TicketsService);
    systemSettingsService = moduleRef.get(SystemSettingsService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    for (const entity of ENTITIES) {
      await dataSource.getRepository(entity).clear();
    }
    (systemSettingsService.find as jest.Mock).mockResolvedValue(null);
  });

  it("POST /tickets/next returns the highest priority waiting ticket", async () => {
    const serviceRepo = dataSource.getRepository(ServiceEntity);

    const regularService = await servicesService.create({
      name: "Atención general",
      prefix: "AG",
      estimatedTime: 5,
      priority: 3,
    });

    const priorityService = await servicesService.create({
      name: "Servicio prioritario",
      prefix: "SP",
      estimatedTime: 5,
      priority: 5,
    });

    await serviceRepo.update(priorityService.id, {
      priorityLevel: 6,
      systemLocked: true,
    });

    await ticketsService.create(regularService.id, {});
    await ticketsService.create(priorityService.id, {});

    (systemSettingsService.find as jest.Mock).mockResolvedValue({ value: "3" });

    const response = await request(app.getHttpServer())
      .post("/tickets/next")
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        priorityLevel: 6,
        serviceId: priorityService.id,
      }),
    );
  });

  it("persists and returns the provided mobile phone when creating a ticket", async () => {
    const service = await servicesService.create({
      name: "Atención personalizada",
      prefix: "AP",
      estimatedTime: 5,
      priority: 2,
    });

    const client = await clientsService.create({
      dni: "12345678",
      name: "Juan Pérez",
    });

    const payload = {
      mobilePhone: "+5491112345678",
      priority: 4,
      clientId: client.id,
    };

    const response = await request(app.getHttpServer())
      .post(`/tickets/${service.id}`)
      .send(payload)
      .expect(201);

    expect(response.body.mobilePhone).toBe(payload.mobilePhone);
    expect(response.body.priorityLevel).toBe(payload.priority);
    expect(response.body.clientId).toBe(client.id);

    const stored = await ticketsService.findOne(response.body.id);
    expect(stored.mobilePhone).toBe(payload.mobilePhone);
    expect(stored.priorityLevel).toBe(payload.priority);
    expect(stored.clientId).toBe(client.id);
    expect(stored.serviceId).toBe(service.id);
  });
});
