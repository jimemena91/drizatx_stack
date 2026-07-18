import { Injectable } from '@nestjs/common';

export const MetricsExclusionReason = {
  ShortAttention: 'SHORT_ATTENTION',
} as const;

export type MetricsExclusionReason =
  (typeof MetricsExclusionReason)[keyof typeof MetricsExclusionReason];

export interface TicketMetricsContext {
  attentionDurationSeconds: number | null;
  serviceId: number | null;
  operatorId: number | null;
}

export interface TicketMetricsEvaluation {
  countsForMetrics: boolean;
  exclusionReason: MetricsExclusionReason | null;
}

/**
 * Fuente única de verdad para decidir si una atención debe computar en métricas.
 *
 * Regla inicial:
 * - atenciones completadas menores a 60 segundos no cuentan para métricas.
 *
 * Más adelante este valor debe leerse desde SystemSettings para permitir configuración
 * por administración, servicio o cliente sin tocar reportes.
 */
@Injectable()
export class MetricsPolicyService {
  private readonly minimumProductiveAttentionSeconds = 60;

  evaluate(context: TicketMetricsContext): TicketMetricsEvaluation {
    const duration = context.attentionDurationSeconds;

    if (duration !== null && duration < this.minimumProductiveAttentionSeconds) {
      return {
        countsForMetrics: false,
        exclusionReason: MetricsExclusionReason.ShortAttention,
      };
    }

    return {
      countsForMetrics: true,
      exclusionReason: null,
    };
  }
}
