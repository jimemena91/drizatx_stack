import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsAbsencesService } from './reports-absences.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

import { Ticket } from '../../entities/ticket.entity';
import { Service } from '../../entities/service.entity';
import { Operator } from '../../entities/operator.entity';
import { ReportSnapshot } from '../../entities/report-snapshot.entity';
import { TicketEvent } from '../../entities/ticket-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Service, Operator, ReportSnapshot, TicketEvent]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsAbsencesService, PermissionsGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
