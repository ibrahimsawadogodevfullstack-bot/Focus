function clock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function startPerformance(name, context = {}) {
  const startedAt = clock();

  return (details = {}) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    const durationMs = Math.round((clock() - startedAt) * 10) / 10;
    console.info('[perf]', {
      name,
      durationMs,
      ...context,
      ...details,
    });
  };
}
