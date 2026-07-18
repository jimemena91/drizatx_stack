import {
  MetricsExclusionReason,
  MetricsPolicyService,
} from './metrics-policy.service';

describe('MetricsPolicyService', () => {
  let service: MetricsPolicyService;

  beforeEach(() => {
    service = new MetricsPolicyService();
  });

  it('excludes completed attentions shorter than 60 seconds', () => {
    const result = service.evaluate({
      attentionDurationSeconds: 59,
      serviceId: 1,
      operatorId: 1,
    });

    expect(result).toEqual({
      countsForMetrics: false,
      exclusionReason: MetricsExclusionReason.ShortAttention,
    });
  });

  it('includes attentions lasting exactly 60 seconds', () => {
    const result = service.evaluate({
      attentionDurationSeconds: 60,
      serviceId: 1,
      operatorId: 1,
    });

    expect(result).toEqual({
      countsForMetrics: true,
      exclusionReason: null,
    });
  });

  it('preserves compatibility when duration is unavailable', () => {
    const result = service.evaluate({
      attentionDurationSeconds: null,
      serviceId: 1,
      operatorId: 1,
    });

    expect(result).toEqual({
      countsForMetrics: true,
      exclusionReason: null,
    });
  });

  it('excludes a zero-second attention', () => {
    const result = service.evaluate({
      attentionDurationSeconds: 0,
      serviceId: 1,
      operatorId: 1,
    });

    expect(result).toEqual({
      countsForMetrics: false,
      exclusionReason: MetricsExclusionReason.ShortAttention,
    });
  });
});
