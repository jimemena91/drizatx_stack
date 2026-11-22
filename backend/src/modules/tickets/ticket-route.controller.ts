import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { TicketEventsService, type TicketRoute } from './ticket-events.service';

/**
 * Ruta de un ticket: cuándo se sacó, quién y desde qué puesto lo llamó, quién lo
 * marcó ausente, quién lo retomó y cuánto duró cada tramo.
 * Mismo permiso que el resto de la lectura de tickets del dashboard.
 *
 * Va en dos segmentos (`tickets/route/lookup`) para no chocar con `GET tickets/:id`.
 */
@Controller('tickets/route')
export class TicketRouteController {
  constructor(private readonly events: TicketEventsService) {}

  /** GET /tickets/route/lookup?number=A-123&date=2026-11-20 */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get('lookup')
  @Permissions(Permission.SERVE_TICKETS)
  lookup(@Query('number') number?: string, @Query('date') date?: string): Promise<TicketRoute[]> {
    return this.events.getRoutes(number ?? '', date);
  }
}
