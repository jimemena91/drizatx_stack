import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { CreateSnapshotDto, ListSnapshotsQueryDto } from './dto/create-snapshot.dto';

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ===============================
  // EN VIVO (cálculo on-demand)
  // ===============================
  @Get('summary')
  @Permissions(Permission.VIEW_REPORTS)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getSummary(@Query() q: ReportsQueryDto) {
    return this.reports.summary(q);
  }
  @Get('throughput')
  @Permissions(Permission.VIEW_REPORTS)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getThroughput(@Query() q: ReportsQueryDto) {
    return this.reports.throughput(q);
  }

  // ===============================
  // SNAPSHOTS (histórico/auditoría)
  // ===============================
  @Post('snapshots')
  @Permissions(Permission.VIEW_REPORTS)
  createSnapshot(@Body() body: CreateSnapshotDto) {
    return this.reports.createSnapshot(body);
  }

  @Get('snapshots')
  @Permissions(Permission.VIEW_REPORTS)
  listSnapshots(@Query() q: ListSnapshotsQueryDto) {
    return this.reports.listSnapshots(q);
  }

  @Get('snapshots/:id')
  @Permissions(Permission.VIEW_REPORTS)
  getSnapshot(@Param('id', ParseIntPipe) id: number) {
    return this.reports.getSnapshot(id);
  }

  // ===============================
  // EXPORTACIONES
  // ===============================
  @Get('export.csv')
  @Permissions(Permission.VIEW_REPORTS)
  async exportCsv(@Query() q: ReportsQueryDto, @Res() res: Response) {
    // Ejemplo: exportamos throughput; podés parametrizar "scope" si querés varios formatos
    const rows = await this.reports.throughput(q);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="throughput.csv"');
    res.write('bucket,attended,avgWaitSec\n');
    for (const r of rows) {
      res.write(`${r.bucket},${r.attended},${r.avgWaitSec}\n`);
    }
    res.end();
  }

  @Get('export.xlsx')
  @Permissions(Permission.VIEW_REPORTS)
  async exportXlsx(@Query() q: ReportsQueryDto, @Res() res: Response) {
    // Import dinámico para no cargar exceljs si no se usa
    const Excel = (await import('exceljs')).default;

    const wb = new Excel.Workbook();
    const ws = wb.addWorksheet('Datos');

    ws.addRow(['bucket', 'attended', 'avgWaitSec']);
    const rows = await this.reports.throughput(q);
    rows.forEach(r => ws.addRow([r.bucket, r.attended, r.avgWaitSec]));

    const meta = wb.addWorksheet('Filtros');
    meta.addRow(['from', q.from ?? '']);
    meta.addRow(['to', q.to ?? '']);
    meta.addRow(['serviceId', q.serviceId ?? '']);
    meta.addRow(['operatorId', q.operatorId ?? '']);
    meta.addRow(['ticketNumberFrom', q.ticketNumberFrom ?? '']);
    meta.addRow(['ticketNumberTo', q.ticketNumberTo ?? '']);
    meta.addRow(['granularity', q.granularity ?? 'day']);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="throughput.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }
}
