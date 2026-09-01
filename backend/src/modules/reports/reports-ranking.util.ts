export type OperatorPerformance = {
  operatorId: number;
  name: string;
  completedTickets: number;
  productiveAttentions?: number;
  attendanceRatePct: number | null;
  occupancyPct: number | null;
};

export type RankedOperator<T extends OperatorPerformance = OperatorPerformance> = T & {
  rank: number;
  performanceScore: number;
};

/**
 * Índice de desempeño DrizaTx (0-100).
 *
 * - 50% volumen productivo, normalizado contra el mayor volumen del conjunto filtrado.
 * - 30% efectividad de atención.
 * - 20% continuidad/ocupación.
 *
 * Si una métrica opcional no está disponible, redistribuimos el peso entre las
 * métricas disponibles para no castigar datos que el entorno no puede medir.
 */
export function rankOperators<T extends OperatorPerformance>(operators: T[]): RankedOperator<T>[] {
  if (!operators.length) return [];

  const maxProductive = Math.max(
    1,
    ...operators.map((operator) =>
      Math.max(operator.productiveAttentions ?? operator.completedTickets ?? 0, 0),
    ),
  );

  return operators
    .map((operator) => {
      const productive = Math.max(
        operator.productiveAttentions ?? operator.completedTickets ?? 0,
        0,
      );

      const components: Array<{ value: number; weight: number }> = [
        { value: Math.min(productive / maxProductive, 1), weight: 0.5 },
      ];

      if (operator.attendanceRatePct != null) {
        components.push({
          value: Math.min(Math.max(operator.attendanceRatePct / 100, 0), 1),
          weight: 0.3,
        });
      }

      if (operator.occupancyPct != null) {
        components.push({
          value: Math.min(Math.max(operator.occupancyPct / 100, 0), 1),
          weight: 0.2,
        });
      }

      const weight = components.reduce((sum, component) => sum + component.weight, 0);
      const weighted = components.reduce(
        (sum, component) => sum + component.value * component.weight,
        0,
      );

      return {
        ...operator,
        rank: 0,
        performanceScore: Number(((weighted / weight) * 100).toFixed(1)),
      };
    })
    .sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return b.completedTickets - a.completedTickets;
    })
    .map((operator, index) => ({ ...operator, rank: index + 1 }));
}
