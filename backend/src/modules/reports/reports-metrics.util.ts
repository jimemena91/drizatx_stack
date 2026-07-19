export interface AttentionClassificationMetrics {
  productiveAttentions: number;
  excludedShortAttentions: number;
  completedTotal: number;
  exclusionRate: number;
}

const normalizeCount = (value: unknown): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
};

export function buildAttentionClassificationMetrics(
  productiveValue: unknown,
  excludedValue: unknown,
): AttentionClassificationMetrics {
  const productiveAttentions = normalizeCount(productiveValue);
  const excludedShortAttentions = normalizeCount(excludedValue);
  const completedTotal =
    productiveAttentions + excludedShortAttentions;

  const exclusionRate =
    completedTotal > 0
      ? Number(
          (
            (excludedShortAttentions / completedTotal) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    productiveAttentions,
    excludedShortAttentions,
    completedTotal,
    exclusionRate,
  };
}
