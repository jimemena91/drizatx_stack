import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from '../../entities/operator.entity';
import { Service } from '../../entities/service.entity';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';
import { ReportsAbsencesService, type AbsenceOperatorRow } from './reports-absences.service';
import { rankOperators } from './reports-ranking.util';
import {
  dateTokenInTimeZone,
  formatDateTimeInTimeZone,
} from './reports-date.util';

@Injectable()
export class ReportsExcelService {
  constructor(
    private readonly reports: ReportsService,
    private readonly absences: ReportsAbsencesService,
    @InjectRepository(Service)
    private readonly servicesRepo: Repository<Service>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
  ) {}

  private getClientName() {
    return (
      process.env.REPORT_CLIENT_NAME?.trim() ||
      process.env.CLIENT_NAME?.trim() ||
      'DrizaTx'
    );
  }

  private sanitizeFilePart(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Reporte';
  }

  private duration(seconds: number | null | undefined) {
    if (seconds == null) return null;
    return Number((seconds / 60).toFixed(1));
  }

  private percent(value: number | null | undefined) {
    if (value == null) return null;
    return Number((value / 100).toFixed(4));
  }

  private styleTitleRow(row: any) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    row.alignment = { vertical: 'middle' };
    row.height = 22;
  }

  private styleSectionRow(row: any) {
    row.font = { bold: true, color: { argb: 'FF111827' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
  }

  private styleHeaderRow(row: any) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 20;
  }

  private autosize(worksheet: any, minimum = 12, maximum = 34) {
    worksheet.columns.forEach((column: any) => {
      let width = minimum;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const value = cell.value == null ? '' : String(cell.value);
        width = Math.max(width, Math.min(value.length + 2, maximum));
      });
      column.width = width;
    });
  }

  private async resolveFilterLabels(q: ReportsQueryDto) {
    const [service, operator] = await Promise.all([
      q.serviceId ? this.servicesRepo.findOne({ where: { id: q.serviceId } }) : null,
      q.operatorId ? this.operatorsRepo.findOne({ where: { id: q.operatorId } }) : null,
    ]);

    return {
      serviceName: service?.name ?? (q.serviceId ? `Servicio ${q.serviceId}` : 'Todos'),
      operatorName: operator?.name ?? (q.operatorId ? `Operador ${q.operatorId}` : 'Todos'),
    };
  }

  async build(q: ReportsQueryDto) {
    const Excel = (await import('exceljs')).default;
    const [summary, throughput, serviceMetrics, attentionDetails, labels, absenceReport] =
      await Promise.all([
        this.reports.summary(q),
        this.reports.throughput(q),
        this.reports.serviceMetrics(q),
        this.reports.attentionDetails(q),
        this.resolveFilterLabels(q),
        // Es un extra del Excel: si falla, el resto del reporte se entrega igual.
        this.absences.build(q, 500).catch(() => null),
      ]);

    const clientName = this.getClientName();
    const rankedOperators = rankOperators(summary.operators);
    const generatedAt = new Date();
    const reportTimeZone = q.tz ?? 'America/Argentina/Mendoza';
    const formattedFrom = q.from
      ? formatDateTimeInTimeZone(q.from, reportTimeZone) ?? q.from
      : 'Sin límite';
    const formattedTo = q.to
      ? formatDateTimeInTimeZone(q.to, reportTimeZone) ?? q.to
      : 'Sin límite';
    const formattedGeneratedAt =
      formatDateTimeInTimeZone(generatedAt, reportTimeZone) ??
      generatedAt.toISOString();

    const workbook = new Excel.Workbook();
    workbook.creator = 'DrizaTx';
    workbook.company = clientName;
    workbook.created = generatedAt;
    workbook.modified = generatedAt;

    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.views = [{ state: 'frozen', ySplit: 5 }];
    summarySheet.mergeCells('A1:F1');
    summarySheet.getCell('A1').value = 'DrizaTx — Reporte de Gestión';
    this.styleTitleRow(summarySheet.getRow(1));

    summarySheet.addRow(['Cliente', clientName]);
    summarySheet.addRow(['Período desde', formattedFrom]);
    summarySheet.addRow(['Período hasta', formattedTo]);
    summarySheet.addRow(['Servicio', labels.serviceName]);
    summarySheet.addRow(['Operador', labels.operatorName]);
    summarySheet.addRow([]);

    const kpiTitle = summarySheet.addRow(['Indicadores del período']);
    this.styleSectionRow(kpiTitle);
    const kpiHeader = summarySheet.addRow(['Indicador', 'Valor', 'Unidad']);
    this.styleHeaderRow(kpiHeader);

    summarySheet.addRow(['Tickets del conjunto', summary.totals.total, 'tickets']);
    summarySheet.addRow(['Atenciones productivas', summary.totals.productiveAttentions, 'atenciones']);
    summarySheet.addRow(['Atenciones completadas', summary.totals.completedTotal, 'atenciones']);
    if (absenceReport) {
      summarySheet.addRow(['Ausentes marcados (historial)', absenceReport.absences.total, 'veces']);
      summarySheet.addRow(['Ausentes sin retomar', absenceReport.absences.notRetaken, 'veces']);
      summarySheet.addRow(['Ausencia promedio', this.duration(absenceReport.absences.avgAbsentSeconds), 'min']);
      summarySheet.addRow([
        `Turnos con espera de más de ${absenceReport.thresholdMin} min`,
        absenceReport.longWaits.overThreshold,
        'tickets',
      ]);
    }
    summarySheet.addRow(['Atenciones excluidas', summary.totals.excludedShortAttentions, 'atenciones']);
    const exclusionRow = summarySheet.addRow(['Tasa de exclusión', this.percent(summary.totals.exclusionRate), '%']);
    exclusionRow.getCell(2).numFmt = '0.0%';
    summarySheet.addRow(['Tiempo medio de espera', this.duration(summary.kpis.tmeSec), 'min']);
    summarySheet.addRow(['Tiempo medio de atención', this.duration(summary.kpis.tmaSec), 'min']);
    summarySheet.addRow(['Tiempo total medio', this.duration(summary.kpis.leadSec), 'min']);
    summarySheet.addRow([
      'Pico de actividad',
      summary.kpis.peakBucket
        ? formatDateTimeInTimeZone(summary.kpis.peakBucket, reportTimeZone) ??
          summary.kpis.peakBucket
        : 'Sin datos',
      '',
    ]);
    summarySheet.addRow([]);

    if (q.operatorId) {
      const selected = rankedOperators.find((operator) => operator.operatorId === q.operatorId);
      const operatorTitle = summarySheet.addRow(['Desempeño del operador']);
      this.styleSectionRow(operatorTitle);
      const header = summarySheet.addRow([
        'Operador',
        'Atenciones productivas',
        'Efectividad',
        'Ocupación',
        'Índice de desempeño',
        'Ausentes que marcó',
        'Ausentes que retomó',
        'Retomados productivos',
        'Atención promedio de retomados (min)',
      ]);
      this.styleHeaderRow(header);
      if (selected) {
        const abs = absenceReport?.byOperator.find((row) => row.operatorId === selected.operatorId);
        const row = summarySheet.addRow([
          selected.name,
          selected.productiveAttentions ?? selected.completedTickets,
          this.percent(selected.attendanceRatePct),
          this.percent(selected.occupancyPct),
          selected.performanceScore,
          abs?.markedAbsent ?? 0,
          abs?.retaken ?? 0,
          abs?.retakenProductive ?? 0,
          this.duration(abs?.avgRetakenAttentionSeconds),
        ]);
        row.getCell(3).numFmt = '0.0%';
        row.getCell(4).numFmt = '0.0%';
        row.getCell(5).numFmt = '0.0';
      }
    } else if (rankedOperators.length) {
      const topTitle = summarySheet.addRow(['Top 3 operadores — Índice de desempeño DrizaTx']);
      this.styleSectionRow(topTitle);
      const header = summarySheet.addRow([
        'Posición',
        'Operador',
        'Atenciones productivas',
        'Efectividad',
        'Ocupación',
        'Índice',
      ]);
      this.styleHeaderRow(header);

      rankedOperators.slice(0, 3).forEach((operator) => {
        const row = summarySheet.addRow([
          operator.rank,
          operator.name,
          operator.productiveAttentions ?? operator.completedTickets,
          this.percent(operator.attendanceRatePct),
          this.percent(operator.occupancyPct),
          operator.performanceScore,
        ]);
        row.getCell(4).numFmt = '0.0%';
        row.getCell(5).numFmt = '0.0%';
        row.getCell(6).numFmt = '0.0';
      });
    }

    this.autosize(summarySheet, 14, 40);

    const operatorsSheet = workbook.addWorksheet('Operadores');
    operatorsSheet.views = [{ state: 'frozen', ySplit: 1 }];
    const operatorsHeader = operatorsSheet.addRow([
      'Ranking',
      'Operador',
      'Atenciones productivas',
      'Completadas totales',
      'Excluidas',
      'Tickets gestionados',
      'Efectividad',
      'Espera promedio (min)',
      'Atención promedio (min)',
      'Atenciones/hora',
      'Ocupación',
      'Inactividad promedio (min)',
      'Índice de desempeño',
      'Ausentes que marcó',
      'Ausencia promedio de los que marcó (min)',
      'Marcados sin retomar',
      'Ausentes que retomó',
      'Retomados atendidos',
      'Retomados productivos (1 min o más)',
      'Retomados breves excluidos',
      'Atención promedio de retomados (min)',
      'Atención total de retomados (min)',
      'Atención más larga de retomados (min)',
    ]);
    this.styleHeaderRow(operatorsHeader);
    const absenceByOperator = new Map<number, AbsenceOperatorRow>();
    for (const row of absenceReport?.byOperator ?? []) {
      if (row.operatorId !== null) absenceByOperator.set(row.operatorId, row);
    }

    rankedOperators.forEach((operator) => {
      const row = operatorsSheet.addRow([
        operator.rank,
        operator.name,
        operator.productiveAttentions ?? operator.completedTickets,
        operator.completedTotal,
        operator.excludedShortAttentions,
        operator.totalTickets,
        this.percent(operator.attendanceRatePct),
        this.duration(operator.avgWaitSec),
        this.duration(operator.avgHandleSec),
        operator.throughputPerHour,
        this.percent(operator.occupancyPct),
        this.duration(operator.avgIdleBetweenTicketsSec),
        operator.performanceScore,
        absenceByOperator.get(operator.operatorId)?.markedAbsent ?? 0,
        this.duration(absenceByOperator.get(operator.operatorId)?.avgAbsentSeconds),
        absenceByOperator.get(operator.operatorId)?.notRetaken ?? 0,
        absenceByOperator.get(operator.operatorId)?.retaken ?? 0,
        absenceByOperator.get(operator.operatorId)?.retakenCompleted ?? 0,
        absenceByOperator.get(operator.operatorId)?.retakenProductive ?? 0,
        absenceByOperator.get(operator.operatorId)?.retakenExcludedShort ?? 0,
        this.duration(absenceByOperator.get(operator.operatorId)?.avgRetakenAttentionSeconds),
        this.duration(
          absenceByOperator.get(operator.operatorId)?.retakenProductive
            ? absenceByOperator.get(operator.operatorId)?.totalRetakenAttentionSeconds
            : null,
        ),
        this.duration(absenceByOperator.get(operator.operatorId)?.maxRetakenAttentionSeconds),
      ]);
      row.getCell(7).numFmt = '0.0%';
      row.getCell(11).numFmt = '0.0%';
      row.getCell(13).numFmt = '0.0';
    });
    operatorsSheet.autoFilter = { from: 'A1', to: 'W1' };
    this.autosize(operatorsSheet, 12, 30);

    const servicesSheet = workbook.addWorksheet('Servicios');
    servicesSheet.views = [{ state: 'frozen', ySplit: 1 }];
    const servicesHeader = servicesSheet.addRow([
      'Servicio',
      'Tickets gestionados',
      'Atenciones productivas',
      'Excluidas',
      'Espera promedio (min)',
      'Atención promedio (min)',
    ]);
    this.styleHeaderRow(servicesHeader);

    serviceMetrics.forEach((service) => {
      servicesSheet.addRow([
        service.serviceName,
        service.totalTickets,
        service.productiveAttentions,
        service.excludedShortAttentions,
        this.duration(service.avgWaitSec),
        this.duration(service.avgHandleSec),
      ]);
    });

    servicesSheet.autoFilter = { from: 'A1', to: 'F1' };
    this.autosize(servicesSheet, 14, 30);

    const attentionsSheet = workbook.addWorksheet('Atenciones');
    attentionsSheet.views = [{ state: 'frozen', ySplit: 1 }];
    const attentionsHeader = attentionsSheet.addRow([
      'Ticket',
      'Servicio',
      'Operador',
      'Estado',
      'Creado',
      'Llamado',
      'Inicio atención',
      'Fin atención',
      'Duración (min)',
      'Cuenta para métricas',
      'Motivo exclusión',
      'Inicio',
    ]);
    this.styleHeaderRow(attentionsHeader);

    attentionDetails.forEach((ticket) => {
      attentionsSheet.addRow([
        ticket.number,
        ticket.serviceName,
        ticket.operatorName ?? 'Sin operador',
        ticket.status,
        ticket.createdAt
          ? formatDateTimeInTimeZone(ticket.createdAt, reportTimeZone) ??
            ticket.createdAt
          : null,
        ticket.calledAt
          ? formatDateTimeInTimeZone(ticket.calledAt, reportTimeZone) ??
            ticket.calledAt
          : null,
        ticket.startedAt
          ? formatDateTimeInTimeZone(ticket.startedAt, reportTimeZone) ??
            ticket.startedAt
          : null,
        ticket.completedAt
          ? formatDateTimeInTimeZone(ticket.completedAt, reportTimeZone) ??
            ticket.completedAt
          : null,
        this.duration(ticket.attentionDurationSec),
        ticket.countsForMetrics ? 'Sí' : 'No',
        ticket.metricsExclusionReason ?? '',
        ticket.attentionStartSource ?? '',
      ]);
    });

    attentionsSheet.autoFilter = { from: 'A1', to: 'L1' };
    this.autosize(attentionsSheet, 14, 34);

    const activitySheet = workbook.addWorksheet('Actividad');
    activitySheet.views = [{ state: 'frozen', ySplit: 1 }];
    const activityHeader = activitySheet.addRow([
      q.granularity === 'hour' ? 'Hora' : 'Día',
      'Atenciones productivas',
      'Espera promedio (min)',
    ]);
    this.styleHeaderRow(activityHeader);
    throughput.forEach((item) => {
      const formattedBucket =
        formatDateTimeInTimeZone(item.bucket, reportTimeZone) ?? item.bucket;

      activitySheet.addRow([
        formattedBucket,
        item.attended,
        this.duration(item.avgWaitSec),
      ]);
    });
    activitySheet.autoFilter = { from: 'A1', to: 'C1' };
    this.autosize(activitySheet, 16, 28);

    if (absenceReport) {
      const tz = reportTimeZone;
      const clock = (iso: string | null) => (iso ? formatDateTimeInTimeZone(iso, tz) ?? iso : null);
      const who = (name: string | null, position: string | null) =>
        name ? (position ? `${name} · ${position}` : name) : null;

      const absentSheet = workbook.addWorksheet('Ausentes por operador');
      absentSheet.views = [{ state: 'frozen', ySplit: 1 }];
      this.styleHeaderRow(
        absentSheet.addRow([
          'Operador',
          'Puesto',
          'Ausentes que marcó',
          'Ausentes que retomó',
          'Ausencia promedio (min)',
          'Marcados sin retomar',
          'Retomados atendidos',
          'Retomados productivos (1 min o más)',
          'Retomados breves excluidos',
          'Atención promedio de retomados (min)',
          'Atención total de retomados (min)',
          'Atención más larga de retomados (min)',
        ]),
      );
      absenceReport.byOperator.forEach((row) => {
        absentSheet.addRow([
          row.name,
          row.position,
          row.markedAbsent,
          row.retaken,
          this.duration(row.avgAbsentSeconds),
          row.notRetaken,
          row.retakenCompleted,
          row.retakenProductive,
          row.retakenExcludedShort,
          this.duration(row.avgRetakenAttentionSeconds),
          row.retakenProductive ? this.duration(row.totalRetakenAttentionSeconds) : null,
          this.duration(row.maxRetakenAttentionSeconds),
        ]);
      });
      absentSheet.addRow([]);
      absentSheet.addRow([
        'Total del período',
        null,
        absenceReport.absences.total,
        null,
        this.duration(absenceReport.absences.avgAbsentSeconds),
        absenceReport.absences.notRetaken,
      ]);
      absentSheet.addRow([
        'Sólo incluye turnos desde que se activó el historial de la ruta del ticket.',
      ]);
      absentSheet.autoFilter = { from: 'A1', to: 'L1' };
      this.autosize(absentSheet, 14, 34);

      const detailSheet = workbook.addWorksheet('Ausencias (detalle)');
      detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
      this.styleHeaderRow(
        detailSheet.addRow([
          'Ticket',
          'Hora en que se marcó ausente',
          'Lo marcó',
          'Ausente durante (min)',
          'Lo retomó',
          'Hora en que lo retomó',
          'Atención tras retomarlo (min)',
        ]),
      );
      absenceReport.details.forEach((d) => {
        detailSheet.addRow([
          d.ticketNumber,
          clock(d.markedAt),
          who(d.markedByName, d.markedByPosition) ?? 'No registrado',
          this.duration(d.absentSeconds),
          who(d.takenByName, d.takenByPosition) ?? (d.takenAt ? 'Operador no registrado' : 'Nadie todavía'),
          clock(d.takenAt),
          d.retakenCompleted
            ? d.retakenCountsForMetrics
              ? this.duration(d.retakenAttentionSeconds)
              : `${this.duration(d.retakenAttentionSeconds)} (breve, no cuenta)`
            : d.takenAt
              ? 'En curso o sin atender'
              : null,
        ]);
      });
      detailSheet.autoFilter = { from: 'A1', to: 'G1' };
      this.autosize(detailSheet, 14, 36);

      const waitsSheet = workbook.addWorksheet('Esperas largas');
      waitsSheet.views = [{ state: 'frozen', ySplit: 1 }];
      this.styleHeaderRow(
        waitsSheet.addRow([
          'Ticket',
          'Servicio',
          'Hora en que sacó el turno',
          `Espera (min) · más de ${absenceReport.thresholdMin} min`,
          'Estado',
          'Veces ausente',
          'Sigue esperando',
        ]),
      );
      absenceReport.longWaits.rows.forEach((w) => {
        waitsSheet.addRow([
          w.ticketNumber,
          w.serviceName,
          clock(w.createdAt),
          this.duration(w.waitSeconds),
          ({ WAITING: 'En espera', CALLED: 'Llamado', IN_PROGRESS: 'En atención', COMPLETED: 'Completado', ABSENT: 'Ausente', DAILY_CLOSED: 'Cierre diario' } as Record<string, string>)[w.status] ?? w.status,
          w.absentCount,
          w.ongoing ? 'Sí' : 'No',
        ]);
      });
      waitsSheet.addRow([]);
      waitsSheet.addRow([
        `${absenceReport.longWaits.overThreshold} de ${absenceReport.longWaits.totalTickets} turnos esperaron más de ${absenceReport.thresholdMin} min`,
      ]);
      waitsSheet.autoFilter = { from: 'A1', to: 'G1' };
      this.autosize(waitsSheet, 14, 36);
    }

    const filtersSheet = workbook.addWorksheet('Filtros y metodología');
    const filtersHeader = filtersSheet.addRow(['Campo', 'Valor']);
    this.styleHeaderRow(filtersHeader);
    filtersSheet.addRow(['Cliente', clientName]);
    filtersSheet.addRow(['Desde', formattedFrom]);
    filtersSheet.addRow(['Hasta', formattedTo]);
    filtersSheet.addRow(['Servicio', labels.serviceName]);
    filtersSheet.addRow(['Service ID', q.serviceId ?? 'Todos']);
    filtersSheet.addRow(['Operador', labels.operatorName]);
    filtersSheet.addRow(['Operator ID', q.operatorId ?? 'Todos']);
    filtersSheet.addRow(['Ticket desde', q.ticketNumberFrom ?? 'Sin límite']);
    filtersSheet.addRow(['Ticket hasta', q.ticketNumberTo ?? 'Sin límite']);
    filtersSheet.addRow(['Granularidad', q.granularity ?? 'day']);
    filtersSheet.addRow(['Zona horaria', reportTimeZone]);
    filtersSheet.addRow(['Generado', formattedGeneratedAt]);
    filtersSheet.addRow([]);
    const methodologyTitle = filtersSheet.addRow(['Metodología']);
    this.styleSectionRow(methodologyTitle);
    filtersSheet.addRow([
      'Atenciones productivas',
      'Solo tickets que el backend clasifica con counts_for_metrics = true.',
    ]);
    filtersSheet.addRow([
      'Índice de desempeño',
      '50% volumen productivo normalizado + 30% efectividad + 20% continuidad/ocupación.',
    ]);
    filtersSheet.addRow([
      'Métricas faltantes',
      'Si una métrica opcional no está disponible, su peso se redistribuye entre las disponibles.',
    ]);
    this.autosize(filtersSheet, 20, 80);

    const fromToken = dateTokenInTimeZone(q.from, q.tz);
    const toToken = dateTokenInTimeZone(q.to, q.tz);

    const sanitizedClientName = this.sanitizeFilePart(clientName);
    const clientFilePart = sanitizedClientName
      .replace(/^DrizaTx_?/i, '')
      .replace(/^_+|_+$/g, '');

    const parts = ['DrizaTx'];

    if (clientFilePart) {
      parts.push(clientFilePart);
    }

    if (q.serviceId) {
      parts.push(this.sanitizeFilePart(labels.serviceName));
    }

    if (q.operatorId) {
      parts.push(this.sanitizeFilePart(labels.operatorName));
    }

    const isFullMonth =
      fromToken &&
      toToken &&
      /^\\d{4}-\\d{2}-01$/.test(fromToken) &&
      (() => {
        const [year, month] = fromToken.split('-').map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0))
          .toISOString()
          .slice(0, 10);

        return toToken === lastDay;
      })();

    if (isFullMonth && fromToken) {
      parts.push(fromToken.slice(0, 7));
    } else if (fromToken && toToken) {
      parts.push(`${fromToken}_al_${toToken}`);
    } else if (fromToken) {
      parts.push(`desde_${fromToken}`);
    } else if (toToken) {
      parts.push(`hasta_${toToken}`);
    }

    return {
      workbook,
      filename: `${parts.join('_')}.xlsx`,
    };
  }
}
