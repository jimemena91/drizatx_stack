import { ReportsExcelService } from './reports-excel.service';

it('el Excel incluye ausentes por operador, retomados y su atención', async () => {
  const absences: any = {
    build: async () => ({
      thresholdMin: 30,
      absences: { total: 1, ticketsWithAbsence: 1, avgAbsentSeconds: 900, maxAbsentSeconds: 900, notRetaken: 0 },
      byOperator: [
        { operatorId: 1, name: 'Ana', position: 'Caja 1', markedAbsent: 1, retaken: 0, avgAbsentSeconds: 900, notRetaken: 0, retakenCompleted: 0, retakenProductive: 0, retakenExcludedShort: 0, avgRetakenAttentionSeconds: null, totalRetakenAttentionSeconds: 0, maxRetakenAttentionSeconds: null },
        { operatorId: 2, name: 'Beto', position: 'Caja 2', markedAbsent: 0, retaken: 1, avgAbsentSeconds: null, notRetaken: 0, retakenCompleted: 2, retakenProductive: 1, retakenExcludedShort: 1, avgRetakenAttentionSeconds: 720, totalRetakenAttentionSeconds: 720, maxRetakenAttentionSeconds: 720 },
      ],
      details: [{ ticketId: 1, ticketNumber: 'C-1', serviceId: 1, markedAt: '2026-11-20T13:15:00.000Z', markedByOperatorId: 1, markedByName: 'Ana', markedByPosition: 'Caja 1', absentSeconds: 900, takenAt: '2026-11-20T13:30:00.000Z', takenByOperatorId: 2, takenByName: 'Beto', takenByPosition: 'Caja 2', retakenAttentionSeconds: 720, retakenCompleted: true, retakenCountsForMetrics: true }],
      longWaits: { totalTickets: 1, overThreshold: 0, overThresholdPct: 0, avgWaitSeconds: 60, maxWaitSeconds: 60, rows: [] },
    }),
  };
  const op = (id: number, name: string) => ({ operatorId: id, name, position: null, role: null, active: true, totalTickets: 1, completedTickets: 1, cancelledTickets: 0, abandonedTickets: 0, serviceCount: 1, avgWaitSec: 10, avgHandleSec: 20, avgLeadSec: 30, avgIdleBetweenTicketsSec: 1, totalIdleBetweenTicketsSec: 1, totalWaitSec: 1, totalHandleSec: 1, throughputPerHour: 1, occupancyPct: 50, attendanceRatePct: 100, firstActivityAt: null, lastActivityAt: null, productiveAttentions: 1, excludedShortAttentions: 0, completedTotal: 1, exclusionRate: 0 });
  const reports: any = {
    summary: async () => ({ totals: { total: 1, attended: 1, cancelled: 0, abandoned: 0, productiveAttentions: 1, excludedShortAttentions: 0, completedTotal: 1, exclusionRate: 0 }, kpis: { tmeSec: 1, tmaSec: 1, leadSec: 1, slaPct: null, totalInQueue: null, peakBucket: null }, operators: [op(1, 'Ana'), op(2, 'Beto')] }),
    throughput: async () => [],
    serviceMetrics: async () => [],
    attentionDetails: async () => [],
  };
  const repo: any = { findOne: async () => null };
  const svc = new ReportsExcelService(reports, absences, repo, repo);
  const { workbook } = await svc.build({ from: '2026-11-20T00:00:00Z', to: '2026-11-21T00:00:00Z' } as any);
  const names = workbook.worksheets.map((w: any) => w.name);
  expect(names).toEqual(
    expect.arrayContaining(['Operadores', 'Ausentes por operador', 'Ausencias (detalle)', 'Esperas largas']),
  );

  // Resumen del operador: ausentes que marcó / retomó y atención de los retomados
  const ops = workbook.getWorksheet('Operadores')!;
  const header = ops.getRow(1).values as any[];
  const col = (title: string) => header.indexOf(title);
  const beto = ops.getRow(3).values as any[];
  expect(beto[col('Ausentes que marcó')]).toBe(0);
  expect(beto[col('Ausentes que retomó')]).toBe(1);
  expect(beto[col('Retomados atendidos')]).toBe(2);
  expect(beto[col('Retomados productivos (1 min o más)')]).toBe(1);
  expect(beto[col('Retomados breves excluidos')]).toBe(1);
  expect(beto[col('Atención total de retomados (min)')]).toBe(12);
  expect(beto[col('Atención más larga de retomados (min)')]).toBe(12);
  expect(beto[col('Atención promedio de retomados (min)')]).toBe(12);
  const ana = ops.getRow(2).values as any[];
  expect(ana[col('Ausentes que marcó')]).toBe(1);
  expect(ana[col('Ausencia promedio de los que marcó (min)')]).toBe(15);
  expect(ana[col('Marcados sin retomar')]).toBe(0);

  // Detalle: quién lo marcó y quién lo retomó
  const detail = workbook.getWorksheet('Ausencias (detalle)')!.getRow(2).values as any[];
  expect(detail).toEqual(expect.arrayContaining(['C-1', 'Ana · Caja 1', 'Beto · Caja 2']));

  // Resumen con un operador filtrado: también lleva ausentes que marcó/retomó
  const filtered = await svc.build({ from: '2026-11-20T00:00:00Z', to: '2026-11-21T00:00:00Z', operatorId: 2 } as any);
  const resumen = filtered.workbook.getWorksheet('Resumen')!;
  const cells: unknown[] = [];
  resumen.eachRow((row: any) => cells.push(...(row.values as unknown[])));
  expect(cells).toEqual(expect.arrayContaining(['Ausentes que retomó', 'Ausentes marcados (historial)']));
});
