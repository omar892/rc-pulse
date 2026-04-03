/**
 * RevenueCat Charts API client with rate limiting and retry logic.
 * Rate limit: 15 requests/minute for Charts & Metrics domain.
 */

const BASE_URL = 'https://api.revenuecat.com/v2';
const RATE_LIMIT_DELAY = 4200; // ~14 req/min, safely under the 15/min limit

const VALID_CHARTS = [
  'mrr', 'arr', 'revenue', 'actives', 'actives_movement', 'actives_new',
  'customers_new', 'customers_active', 'trials', 'trials_new', 'trials_movement',
  'trial_conversion_rate', 'conversion_to_paying', 'churn', 'refund_rate',
  'ltv_per_customer', 'ltv_per_paying_customer', 'mrr_movement',
  'subscription_status', 'subscription_retention'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, apiKey, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 429) {
      const waitMs = Math.pow(2, attempt) * 1000;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`API error ${res.status}: ${err.message || res.statusText}`);
    }

    return res.json();
  }
  throw new Error(`Failed after ${retries} retries`);
}

async function getProjects(apiKey) {
  return fetchWithRetry(`${BASE_URL}/projects`, apiKey);
}

async function getOverviewMetrics(apiKey, projectId) {
  return fetchWithRetry(`${BASE_URL}/projects/${projectId}/metrics/overview`, apiKey);
}

async function getChart(apiKey, projectId, chartName, { resolution = 'week', startDate, endDate }) {
  if (!VALID_CHARTS.includes(chartName)) {
    throw new Error(`Unknown chart: ${chartName}. Valid: ${VALID_CHARTS.join(', ')}`);
  }
  const params = new URLSearchParams({ resolution, start_date: startDate, end_date: endDate });
  return fetchWithRetry(
    `${BASE_URL}/projects/${projectId}/charts/${chartName}?${params}`,
    apiKey
  );
}

async function getAllCharts(apiKey, projectId, options, onProgress) {
  const CORE_CHARTS = [
    'mrr', 'arr', 'revenue', 'actives', 'churn',
    'mrr_movement', 'customers_new', 'trials',
    'trial_conversion_rate', 'refund_rate', 'ltv_per_customer'
  ];

  const results = {};
  for (let i = 0; i < CORE_CHARTS.length; i++) {
    const chart = CORE_CHARTS[i];
    if (onProgress) onProgress(chart, i + 1, CORE_CHARTS.length);
    try {
      results[chart] = await getChart(apiKey, projectId, chart, options);
    } catch (e) {
      results[chart] = { error: e.message };
    }
    if (i < CORE_CHARTS.length - 1) await sleep(RATE_LIMIT_DELAY);
  }
  return results;
}

module.exports = { getProjects, getOverviewMetrics, getChart, getAllCharts, VALID_CHARTS };
