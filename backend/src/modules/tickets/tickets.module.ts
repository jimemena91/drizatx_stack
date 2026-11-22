// backend/src/modules/tickets/tickets.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Client } from '../../entities/client.entity';
import { Operator } from '../../entities/operator.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { AuditLog } from '../../entities/audit-log.entity';

import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Módulos cuyos servicios se usan dentro de TicketsService
import { ServicesModule } from '../../modules/services/services.module';
import { ClientsModule } from '../../modules/clients/clients.module';
import { SystemSettingsModule } from '../../modules/system-settings/system-settings.module';
import { QueueEventsModule } from '../queue-events/queue-events.module';
import { MetricsPolicyModule } from '../metrics-policy/metrics-policy.module';
import { BusinessDateModule } from '../business-date/business-date.module';
import { CalledAutoStartScheduler } from './called-auto-start.scheduler';
import { AttentionAlertLog } from '../../entities/attention-alert-log.entity';
import { AttentionAlertLogService } from './attention-alert-log.service';
import { AttentionAlertLogScheduler } from './attention-alert-log.scheduler';
import { AttentionAlertLogController } from './attention-alert-log.controller';
import { TicketEvent } from '../../entities/ticket-event.entity';
import { TicketEventsService } from './ticket-events.service';
import { TicketEventsSubscriber } from './ticket-events.subscriber';
import { TicketRouteController } from './ticket-route.controller';

@Module({
  imports: [
    // 👇 AQUI va TODO lo que necesites inyectar con @InjectRepository(...)
    QueueEventsModule,
    MetricsPolicyModule,
    BusinessDateModule,
    TypeOrmModule.forFeature([
      Ticket,
      ServiceEntity,
      Client,
      Operator,          // ✅ movido adentro de forFeature
      OperatorService,   // ✅ movido adentro de forFeature
      AuditLog,
      AttentionAlertLog,
      TicketEvent,
    ]),

    // Otros módulos (servicios de dominio)
    ServicesModule,
    ClientsModule,
    SystemSettingsModule,
  ],
  providers: [
    TicketsService,
    PermissionsGuard,
    CalledAutoStartScheduler,
    AttentionAlertLogService,
    AttentionAlertLogScheduler,
    TicketEventsService,
    TicketEventsSubscriber,
  ],
  controllers: [TicketsController, AttentionAlertLogController, TicketRouteController],
  exports: [TicketsService, TypeOrmModule],
})
export class TicketsModule {}
