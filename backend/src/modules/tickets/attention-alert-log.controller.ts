import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import {
  AttentionAlertLogService,
  type AttentionAlertHistory,
  type AttentionAlertSummary,
} from './attention-alert-log.service';

/**
 * Historial de alertas de tiempo de atención excedido.
 * Mismo permiso que la lectura de alertas en vivo (SERVE_TICKETS).
 */
@Controller('tickets/alerts/attention')
export class AttentionAlertLogController {
  constructor(private readonly alertLog: AttentionAlertLogService) {}

  /** GET /tickets/alerts/attention/summary -> contador del día para el ícono */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get('summary')
  @Permissions(Permission.SERVE_TICKETS)
  summary(): Promise<AttentionAlertSummary> {
    return this.alertLog.getSummary();
  }

  /** GET /tickets/alerts/attention/history?days=30 -> historial agrupado por día */
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Get('history')
  @Permissions(Permission.SERVE_TICKETS)
  history(@Query('days') days?: string): Promise<AttentionAlertHistory> {
    const parsed = days === undefined ? undefined : Number(days);
    return this.alertLog.getHistory(parsed);
  }
}
