import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AuthGuard } from "@nestjs/passport";

import { TerminalController } from "./terminal.controller";
import { TerminalService } from "./terminal.service";
import { RolesGuard } from "../../common/guards/roles.guard";

const JwtAuthGuard = AuthGuard("jwt");

describe("TerminalController", () => {
  let app: INestApplication;
  const terminalService: {
    sendTicketToPrinter: jest.Mock<Promise<void>, any[]>;
  } = {
    sendTicketToPrinter: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TerminalController],
      providers: [
        {
          provide: TerminalService,
          useValue: terminalService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const requestContext = context.switchToHttp().getRequest();
          requestContext.user = { role: "OPERATOR" };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  it("delega en el servicio y responde éxito", async () => {
    const payload = {
      ticketId: 1,
      serviceId: 2,
      ticketNumber: "A001",
      serviceName: "Caja",
      payload: { ticket: { id: 1 } },
    };

    terminalService.sendTicketToPrinter.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post("/api/terminal/print")
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({ success: true });
    expect(terminalService.sendTicketToPrinter).toHaveBeenCalledWith(payload);
  });
});
