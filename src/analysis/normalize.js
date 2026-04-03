/**
 * Normalize raw RevenueCat Charts API data into structured time-series.
 */

function getCompletedValues(chartData, measureIndex = 0) {
  if (!chartData || !chartData.values) return [];
  return chartData.values
    .filter(v => v.measure === measureIndex && !v.incomplete)
    .map(v => ({ date: new Date(v.cohort * 1000).toISOString().split('T')[0], value: v.value }));
}

function rollingAverage(values, window = 4) {
  return values.map((v, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.value, 0) / slice.length;
    return { date: v.date, value: avg };
  });
}

function periodOverPeriod(values, periods = 4) {
  if (values.length < periods * 2) return null;
  const recent = values.slice(-periods);
  const prior = values.slice(-periods * 2, -periods);
  const recentSum = recent.reduce((s, v) => s + v.value, 0);
  const priorSum = prior.reduce((s, v) => s + v.value, 0);
  if (priorSum === 0) return null;
  return ((recentSum - priorSum) / priorSum) * 100;
}

function trend(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  const first = values.slice(0, Math.ceil(n / 4)).reduce((s, v) => s + v.value, 0) / Math.ceil(n / 4);
  const last = values.slice(-Math.ceil(n / 4)).reduce((s, v) => s + v.value, 0) / Math.ceil(n / 4);
  return first === 0 ? 0 : ((last - first) / first) * 100;
}

function normalizeAll(charts) {
  const mrr = getCompletedValues(charts.mrr);
  const arr = getCompletedValues(charts.arr);
  const revenue = getCompletedValues(charts.revenue, 0); // revenue measure
  const actives = getCompletedValues(charts.actives);
  const churnRate = getCompletedValues(charts.churn, 2); // churn rate measure
  const churned = getCompletedValues(charts.churn, 1);   // churned actives
  const newMrr = getCompletedValues(charts.mrr_movement, 0);
  const churnedMrr = getCompletedValues(charts.mrr_movement, 3);
  const netMrrMovement = getCompletedValues(charts.mrr_movement, 5);
  const newCustomers = getCompletedValues(charts.customers_new);
  const trials = getCompletedValues(charts.trials);
  const trialConversion = getCompletedValues(charts.trial_conversion_rate);
  const refundRate = getCompletedValues(charts.refund_rate, 2);
  const ltv = getCompletedValues(charts.ltv_per_customer);

  return {
    mrr: { values: mrr, trend: trend(mrr), pop: periodOverPeriod(mrr), rolling: rollingAverage(mrr) },
    arr: { values: arr, current: arr[arr.length - 1]?.value },
    revenue: { values: revenue, trend: trend(revenue), pop: periodOverPeriod(revenue) },
    actives: { values: actives, trend: trend(actives), pop: periodOverPeriod(actives) },
    churnRate: { values: churnRate, avg: churnRate.reduce((s, v) => s + v.value, 0) / (churnRate.length || 1) },
    churned: { values: churned },
    mrrMovement: { newMrr, churnedMrr, net: netMrrMovement },
    newCustomers: { values: newCustomers, trend: trend(newCustomers) },
    trials: { values: trials, trend: trend(trials) },
    trialConversion: { values: trialConversion, avg: trialConversion.reduce((s, v) => s + v.value, 0) / (trialConversion.length || 1) },
    refundRate: { values: refundRate, avg: refundRate.reduce((s, v) => s + v.value, 0) / (refundRate.length || 1) },
    ltv: { values: ltv, trend: trend(ltv) }
  };
}

module.exports = { normalizeAll, getCompletedValues, trend, periodOverPeriod };
