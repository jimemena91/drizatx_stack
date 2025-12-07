import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { QueuePublicController } from './queue-public.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { Ticket } from '../../entities/ticket.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Operator } from '../../entities/operator.entity';
import { Client } from '../../entities/client.entity';
import { OperatorService as OperatorServiceEntity } from '../../entities/operator-service.entity';

// Importá los módulos cuyos servicios vas a inyectar en QueueService
import { ServicesModule } from '../../modules/services/services.module';
import { OperatorsModule } from '../../modules/operators/operators.module';
import { ClientsModule } from '../../modules/clients/clients.module';
import { TicketsModule } from '../../modules/tickets/tickets.module';
// (Opcional) si tenés TicketsModule propio: importalo y exportá su service

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, ServiceEntity, Operator, Client, OperatorServiceEntity]), // 👈 Repos que inyecta QueueService
    ServicesModule,     // 👈 Exporta ServicesService
    OperatorsModule,    // 👈 Exporta OperatorsService
    ClientsModule,      // 👈 Exporta ClientsService
    TicketsModule,
  ],
  providers: [QueueService, PermissionsGuard],
  controllers: [QueueController, QueuePublicController],
  exports: [QueueService, TicketsModule],
})
export class QueueModule {}
