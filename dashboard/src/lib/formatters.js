function getSignedPrefix(value) {
  const amount = Number(value);
  if (amount > 0) {
    return "";
  }
  if (amount < 0) {
    return "−";
  }
  return "";
}

export function formatCurrency(value) {
  return `£${Math.round(Number(value)).toLocaleString("en-GB")}`;
}

export function formatSignedCurrency(value) {
  const amount = Math.round(Number(value));
  return `${getSignedPrefix(amount)}£${Math.abs(amount).toLocaleString("en-GB")}`;
}

export function formatBn(value) {
  return `£${Number(value).toFixed(2)}bn`;
}

export function formatSignedBn(value) {
  const amount = Number(value);
  return `${getSignedPrefix(amount)}£${Math.abs(amount).toFixed(2)}bn`;
}

export function formatMn(value) {
  return `£${Math.round(Number(value)).toLocaleString("en-GB")}m`;
}

export function formatPct(value, digits = 1) {
  return `${Number(value).toFixed(digits)}%`;
}

export function formatSignedPct(value, digits = 1) {
  return `${getSignedPrefix(value)}${formatPct(Math.abs(Number(value)), digits)}`;
}

export function formatCount(value) {
  const num = Number(value);
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}m`;
  }
  if (num >= 1e3) {
    return `${Math.round(num / 1e3).toLocaleString("en-GB")}k`;
  }
  return num.toLocaleString("en-GB");
}
