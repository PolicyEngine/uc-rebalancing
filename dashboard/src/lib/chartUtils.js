const NICE_STEPS = [1, 2, 2.5, 5, 10];

function niceStep(roughStep) {
  if (roughStep <= 0) {
    throw new Error(`niceStep requires a positive step, got ${roughStep}`);
  }
  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = 10 ** exponent;
  const normalized = roughStep / magnitude;
  const nice = NICE_STEPS.find((step) => step >= normalized - 1e-10);
  return nice * magnitude;
}

function normaliseZero(value) {
  return value === 0 ? 0 : value;
}

export function getNiceTicks(domain, count = 5) {
  const [domainMin, domainMax] = domain;
  if (domainMin === domainMax) {
    throw new Error(
      `getNiceTicks requires a non-degenerate domain, got [${domainMin}, ${domainMax}]`,
    );
  }
  const rawStep = (domainMax - domainMin) / Math.max(count - 1, 1);
  const step = niceStep(rawStep);
  const start = Math.floor(domainMin / step) * step;
  const ticks = [];
  for (let value = start; value <= domainMax + step * 0.01; value += step) {
    ticks.push(normaliseZero(Math.round(value * 1e10) / 1e10));
  }
  if (ticks.length >= 2 && ticks[ticks.length - 1] < domainMax) {
    ticks.push(
      normaliseZero(Math.round((ticks[ticks.length - 1] + step) * 1e10) / 1e10),
    );
  }
  return ticks;
}

export function getTickDomain(ticks) {
  if (!ticks.length) {
    throw new Error("getTickDomain requires at least one tick");
  }
  return [ticks[0], ticks[ticks.length - 1]];
}
