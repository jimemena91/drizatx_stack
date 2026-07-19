import { buildAttentionClassificationMetrics } from './reports-metrics.util';

describe('buildAttentionClassificationMetrics', () => {
  it('calcula productivas, excluidas, total y tasa', () => {
    expect(
      buildAttentionClassificationMetrics(12, 1),
    ).toEqual({
      productiveAttentions: 12,
      excludedShortAttentions: 1,
      completedTotal: 13,
      exclusionRate: 7.7,
    });
  });

  it('devuelve tasa cero cuando no hay finalizadas', () => {
    expect(
      buildAttentionClassificationMetrics(0, 0),
    ).toEqual({
      productiveAttentions: 0,
      excludedShortAttentions: 0,
      completedTotal: 0,
      exclusionRate: 0,
    });
  });

  it('normaliza valores SQL nulos o inválidos', () => {
    expect(
      buildAttentionClassificationMetrics(null, undefined),
    ).toEqual({
      productiveAttentions: 0,
      excludedShortAttentions: 0,
      completedTotal: 0,
      exclusionRate: 0,
    });
  });

  it('acepta conteos SQL representados como texto', () => {
    expect(
      buildAttentionClassificationMetrics('84', '6'),
    ).toEqual({
      productiveAttentions: 84,
      excludedShortAttentions: 6,
      completedTotal: 90,
      exclusionRate: 6.7,
    });
  });
});
