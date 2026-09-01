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
import { ReportsExcelService } from './reports-excel.service';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { CreateSnapshotDto, ListSnapshotsQueryDto } from './dto/create-snapshot.dto';

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly reportsExcel: ReportsExcelService,
  ) {}

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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async exportXlsx(@Query() q: ReportsQueryDto, @Res() res: Response) {
    const { workbook, filename } = await this.reportsExcel.build(q);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
