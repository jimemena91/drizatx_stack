import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TicketsService, type AttentionAlert } from './tickets.service';
import { Ticket } from '../../entities/ticket.entity';
import { Status } from '../../common/enums/status.enum';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // ============================================================
  // Lecturas / utilitarios
  // ============================================================

  /**
   * Estimar tiempo de espera para un servicio
   * GET /tickets/estimate/:serviceId
   * (ruta específica ANTES que las dinámicas)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get('estimate/:serviceId')
  @Permissions(Permission.SERVE_TICKETS)
  estimate(@Param('serviceId', ParseIntPipe) serviceId: number): Promise<number> {
    return this.tickets.estimateWaitTime(serviceId);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get('alerts/attention')
  @Permissions(Permission.SERVE_TICKETS)
  attentionAlerts(): Promise<AttentionAlert[]> {
    return this.tickets.getAttentionAlerts();
  }

  /**
   * Siguiente ticket de la cola GLOBAL (para cartelería / dashboard)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Post('next')
  @HttpCode(200)
  @Permissions(Permission.SERVE_TICKETS)
  next(): Promise<Ticket | null> {
    return this.tickets.findNextTicketForGlobalQueue();
  }

  /**
   * Obtener un ticket por ID
   * GET /tickets/:id
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get(':id')
  @Permissions(Permission.SERVE_TICKETS)
  get(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.findOne(id);
  }

  // ============================================================
  // Creación / cancelación
  // ============================================================

  /**
   * Crear un ticket para un servicio
   * POST /tickets/:serviceId
   * Body opcional: { clientId?: number, mobilePhone?: string, priority?: number }
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Post(':serviceId')
  @Permissions(Permission.SERVE_TICKETS)
  create(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: CreateTicketDto,
  ): Promise<Ticket> {
    const { clientId, mobilePhone, priority } = dto;
    return this.tickets.create(serviceId, { clientId, mobilePhone, priority });
  }

  /**
   * Cancelar un ticket
   * DELETE /tickets/:id
   * Respuesta: 204 No Content
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Delete(':id')
  @HttpCode(204)
  @Permissions(Permission.SERVE_TICKETS)
  async cancel(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tickets.cancel(id);
  }

  // ============================================================
  // Ciclo de vida / transiciones
  // ============================================================

  /** Iniciar atención (CALLED -> IN_PROGRESS) */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/start')
  @Permissions(Permission.SERVE_TICKETS)
  start(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.startAttention(id);
  }

  /** Finalizar atención (IN_PROGRESS -> COMPLETED) */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/complete')
  @Permissions(Permission.SERVE_TICKETS)
  complete(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.complete(id);
  }

  /**
   * Endpoint unificado de estado (recomendado por simplicidad de front)
   * PATCH /tickets/:id/status
   * Body: { status: Status }  // p.ej. ABSENT o WAITING (reintegrar)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/status')
  @Permissions(Permission.SERVE_TICKETS)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { status: Status },
  ): Promise<Ticket> {
    return this.tickets.updateStatus(id, dto.status);
  }

  /**
   * Marcar ausente (wrapper de conveniencia)
   * CALLED/IN_PROGRESS -> ABSENT
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/absent')
  @Permissions(Permission.SERVE_TICKETS)
  absent(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.updateStatus(id, Status.ABSENT);
  }

  /**
   * Reintegrar (wrapper de conveniencia)
   * ABSENT -> WAITING (vuelve al final de la cola)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/reintegrate')
  @Permissions(Permission.SERVE_TICKETS)
  reintegrate(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.updateStatus(id, Status.WAITING);
  }

  /**
   * Llamar un ticket puntual por ID (WAITING/ABSENT -> CALLED)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Patch(':id/call')
  @Permissions(Permission.SERVE_TICKETS)
  call(
    @Param('id', ParseIntPipe) id: number,
    @Body('operatorId', ParseIntPipe) operatorId: number,
  ): Promise<Ticket> {
    return this.tickets.callTicket(id, operatorId);
  }

  /**
   * Llamar el siguiente ticket de la cola para UN servicio concreto
   * (modo anterior: el front manda serviceId)
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Post('call-next')
  @Permissions(Permission.SERVE_TICKETS)
  callNext(
    @Body() dto: { operatorId: number; serviceId: number },
  ): Promise<Ticket | null> {
    return this.tickets.callNextTicket(dto.operatorId, dto.serviceId);
  }

  /**
   * NUEVO: Llamar el siguiente ticket considerando TODOS los servicios
   * habilitados para el operador, usando priority_level + queue.alternate_priority_every.
   *
   * Body: { operatorId: number }
   */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Post('call-next-operator')
  @Permissions(Permission.SERVE_TICKETS)
  callNextForOperator(
    @Body('operatorId', ParseIntPipe) operatorId: number,
  ): Promise<Ticket | null> {
    return this.tickets.callNextForOperator(operatorId);
  }

  @Post(':id/qr-scan')
  qrScan(@Param('id', ParseIntPipe) id: number): Promise<Ticket> {
    return this.tickets.registerQrScan(id);
  }
}
