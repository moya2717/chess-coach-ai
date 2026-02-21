export function buildTrendSeries(analysisRuns) {
  return [...analysisRuns]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((run) => ({
      createdAt: run.createdAt,
      accuracy: run.metrics?.accuracy ?? 0,
      blundersPerGame: run.metrics?.blundersPerGame ?? 0,
      openingWeakness: run.metrics?.phaseWeakness?.opening ?? 0,
      endgameWeakness: run.metrics?.phaseWeakness?.endgame ?? 0,
    }));
}

export function computeDeltaSummary(analysisRuns, now = Date.now()) {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const current = analysisRuns.filter((run) => now - new Date(run.createdAt).getTime() <= thirtyDays);
  const previous = analysisRuns.filter((run) => {
    const age = now - new Date(run.createdAt).getTime();
    return age > thirtyDays && age <= thirtyDays * 2;
  });

  return {
    accuracy: averageMetric(current, 'accuracy') - averageMetric(previous, 'accuracy'),
    blundersPerGame: averageMetric(current, 'blundersPerGame') - averageMetric(previous, 'blundersPerGame'),
    openingWeakness: averageNestedMetric(current, ['phaseWeakness', 'opening']) - averageNestedMetric(previous, ['phaseWeakness', 'opening']),
    endgameWeakness: averageNestedMetric(current, ['phaseWeakness', 'endgame']) - averageNestedMetric(previous, ['phaseWeakness', 'endgame']),
  };
}

export function formatDelta(value, suffix) {
  if (Number.isNaN(value)) {
    return 'N/A';
  }
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}

function averageMetric(runs, key) {
  if (!runs.length) {
    return NaN;
  }
  const total = runs.reduce((sum, run) => sum + (run.metrics?.[key] ?? 0), 0);
  return total / runs.length;
}

function averageNestedMetric(runs, path) {
  if (!runs.length) {
    return NaN;
  }
  const total = runs.reduce((sum, run) => sum + (run.metrics?.[path[0]]?.[path[1]] ?? 0), 0);
  return total / runs.length;
}
