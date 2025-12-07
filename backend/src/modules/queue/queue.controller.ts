import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QueueService, QueueDashboardResponse } from './queue.service';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Ticket } from '../../entities/ticket.entity';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('services/active')
  @Permissions(Permission.SERVE_TICKETS)
  getActiveServices(): Promise<ServiceEntity[]> {
    return this.queueService.getActiveServices();
  }

  @Post('enqueue/:serviceId')
  @Permissions(Permission.SERVE_TICKETS)
  enqueue(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body('clientId') clientId?: number,
  ): Promise<Ticket> {
    return this.queueService.enqueue(serviceId, clientId);
  }

  @Get('next/:serviceId')
  @Permissions(Permission.SERVE_TICKETS)
  next(@Param('serviceId', ParseIntPipe) serviceId: number): Promise<Ticket | null> {
    return this.queueService.nextTicketToCall(serviceId);
  }

  @Post('call/:ticketId/:operatorId')
  @Permissions(Permission.SERVE_TICKETS)
  call(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('operatorId', ParseIntPipe) operatorId: number,
  ): Promise<Ticket> {
    return this.queueService.callTicket(ticketId, operatorId);
  }

  @Post('start/:ticketId')
  @Permissions(Permission.SERVE_TICKETS)
  start(@Param('ticketId', ParseIntPipe) ticketId: number): Promise<Ticket> {
    return this.queueService.startTicket(ticketId);
  }

  @Post('complete/:ticketId')
  @Permissions(Permission.SERVE_TICKETS)
  complete(@Param('ticketId', ParseIntPipe) ticketId: number): Promise<Ticket> {
    return this.queueService.completeTicket(ticketId);
  }

  @Get('dashboard')
  @Permissions(Permission.VIEW_DASHBOARD, Permission.SERVE_TICKETS)
  async dashboard(): Promise<QueueDashboardResponse> {
    return this.queueService.getDashboard();
  }
}
