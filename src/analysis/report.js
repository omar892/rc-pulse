/**
 * Generate a subscription health report from normalized data.
 * Works without Claude — uses deterministic scoring + rule-based insights.
 * Outputs clean Markdown.
 */

function healthScore(normalized) {
  let score = 100;
  const n = normalized;

  // MRR trend (max impact: -25)
  if (n.mrr.trend < -5) score -= 25;
  else if (n.mrr.trend < -2) score -= 15;
  else if (n.mrr.trend < 0) score -= 8;
  else if (n.mrr.trend > 5) score += 5;

  // Churn rate (max impact: -20)
  const avgChurn = n.churnRate.avg;
  if (avgChurn > 5) score -= 20;
  else if (avgChurn > 3) score -= 12;
  else if (avgChurn > 1.5) score -= 6;

  // Churned MRR vs New MRR balance (max impact: -20)
  const recentNew = n.mrrMovement.newMrr.slice(-4);
  const recentChurned = n.mrrMovement.churnedMrr.slice(-4);
  if (recentNew.length && recentChurned.length) {
    const avgNew = recentNew.reduce((s, v) => s + v.value, 0) / recentNew.length;
    const avgChurned = recentChurned.reduce((s, v) => s + v.value, 0) / recentChurned.length;
    if (avgChurned > avgNew * 1.5) score -= 20;
    else if (avgChurned > avgNew) score -= 10;
    else score += 5;
  }

  // Trial conversion (max impact: -15)
  const tcr = n.trialConversion.avg;
  if (tcr < 30) score -= 15;
  else if (tcr < 50) score -= 8;
  else if (tcr > 65) score += 5;

  // Active subscriber trend (max impact: -10)
  if (n.actives.trend < -3) score -= 10;
  else if (n.actives.trend < 0) score -= 4;
  else if (n.actives.trend > 3) score += 5;

  // LTV trend
  if (n.ltv.trend < -5) score -= 5;
  else if (n.ltv.trend > 5) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(score) {
  if (score >= 80) return { label: 'Healthy', emoji: '🟢' };
  if (score >= 60) return { label: 'Stable', emoji: '🟡' };
  if (score >= 40) return { label: 'At Risk', emoji: '🟠' };
  return { label: 'Critical', emoji: '🔴' };
}

function detectRedFlags(normalized) {
  const flags = [];
  const n = normalized;

  // Churned MRR > New MRR
  const recentNew = n.mrrMovement.newMrr.slice(-4);
  const recentChurned = n.mrrMovement.churnedMrr.slice(-4);
  if (recentNew.length && recentChurned.length) {
    const avgNew = recentNew.reduce((s, v) => s + v.value, 0) / recentNew.length;
    const avgChurned = recentChurned.reduce((s, v) => s + v.value, 0) / recentChurned.length;
    if (avgChurned > avgNew) {
      flags.push({
        severity: 'HIGH',
        flag: `Churned MRR ($${avgChurned.toFixed(0)}/wk avg) exceeds New MRR ($${avgNew.toFixed(0)}/wk avg)`,
        implication: 'You are losing subscribers faster than you acquire them. Without intervention, MRR will continue declining.'
      });
    }
  }

  // Revenue vs MRR divergence
  if (n.revenue.trend > 2 && n.mrr.trend < -1) {
    flags.push({
      severity: 'MEDIUM',
      flag: 'Revenue trending up while MRR trends down',
      implication: 'One-time purchases or short-duration plans may be masking subscription decay. This "sugar rush" is not sustainable.'
    });
  }

  // Trial conversion volatility
  const tcrVals = n.trialConversion.values;
  if (tcrVals.length >= 4) {
    const recent = tcrVals.slice(-4).map(v => v.value);
    const range = Math.max(...recent) - Math.min(...recent);
    if (range > 20) {
      flags.push({
        severity: 'MEDIUM',
        flag: `Trial conversion rate is volatile (${Math.min(...recent).toFixed(0)}%–${Math.max(...recent).toFixed(0)}% in last 4 weeks)`,
        implication: 'Inconsistent trial-to-paid conversion suggests a non-structural factor — possible paywall issue, seasonal skew, or cohort quality variation.'
      });
    }
  }

  // MRR declining 9-month trend
  if (n.mrr.trend < -1) {
    flags.push({
      severity: 'MEDIUM',
      flag: `MRR has declined ${Math.abs(n.mrr.trend).toFixed(1)}% over the analysis period`,
      implication: 'Slow consistent decline is the hardest to spot because it never triggers an alarm — until the cumulative effect becomes significant.'
    });
  }

  return flags;
}

function recommendations(normalized, flags) {
  const recs = [];

  // If churned > new MRR
  const hasChurnProblem = flags.some(f => f.flag.includes('Churned MRR'));
  if (hasChurnProblem) {
    recs.push('**Investigate churn cohorts.** Which subscription duration churns fastest? Annual subscribers who churn at renewal are a different problem than monthly churners who quit in month 2. RevenueCat\'s subscription_retention chart will show you where the drop-off occurs.');
    recs.push('**Run a win-back campaign.** Recent churned subscribers are your warmest potential re-converts — they already know the product. A targeted 20% discount via RevenueCat Paywalls can be shipped in hours.');
  }

  // Trial conversion
  if (normalized.trialConversion.avg < 60) {
    recs.push('**Audit your trial-to-paid experience.** At ~' + normalized.trialConversion.avg.toFixed(0) + '% average conversion, there\'s room to improve. Common wins: shorten trial period (urgency), improve Day 1 onboarding, or add an in-trial engagement push on Day 5.');
  }

  // New customer trend
  if (normalized.newCustomers.trend < 0) {
    recs.push('**Top-of-funnel is contracting.** New customer acquisition has declined ' + Math.abs(normalized.newCustomers.trend).toFixed(0) + '% over the period. Test App Store creative refresh or keyword expansion before assuming product-market fit issues.');
  } else {
    recs.push('**New customer acquisition is healthy — protect it.** Your conversion problem is downstream. Retention, not acquisition, is the priority lever right now.');
  }

  return recs.slice(0, 3);
}

function generateMarkdownReport(appName, normalized, charts) {
  const score = healthScore(normalized);
  const { label, emoji } = scoreLabel(score);
  const flags = detectRedFlags(normalized);
  const recs = recommendations(normalized, flags);

  const mrrCurrent = normalized.mrr.values[normalized.mrr.values.length - 1]?.value || 0;
  const mrrStart = normalized.mrr.values[0]?.value || 0;
  const mrrChange = mrrStart ? ((mrrCurrent - mrrStart) / mrrStart * 100).toFixed(1) : 'N/A';

  const activeCurrent = normalized.actives.values[normalized.actives.values.length - 1]?.value || 0;
  const activeStart = normalized.actives.values[0]?.value || 0;

  const avgChurn = normalized.churnRate.avg.toFixed(2);
  const avgTCR = normalized.trialConversion.avg.toFixed(0);
  const arrCurrent = normalized.arr.current ? `$${normalized.arr.current.toLocaleString()}` : 'N/A';

  const recentNew = normalized.mrrMovement.newMrr.slice(-4);
  const recentChurned = normalized.mrrMovement.churnedMrr.slice(-4);
  const avgNewMrr = recentNew.length ? (recentNew.reduce((s, v) => s + v.value, 0) / recentNew.length).toFixed(0) : 'N/A';
  const avgChurnedMrr = recentChurned.length ? (recentChurned.reduce((s, v) => s + v.value, 0) / recentChurned.length).toFixed(0) : 'N/A';

  const now = new Date().toISOString().split('T')[0];

  return `# RC Pulse — Subscription Health Report
> **${appName}** · Generated ${now} · Powered by RevenueCat Charts API

---

## ${emoji} Health Score: ${score}/100 — ${label}

| Metric | Current | Trend |
|--------|---------|-------|
| MRR | $${mrrCurrent.toFixed(0)} | ${mrrChange > 0 ? '▲' : '▼'} ${Math.abs(mrrChange)}% |
| ARR | ${arrCurrent} | — |
| Active Subscribers | ${activeCurrent.toFixed(0)} | ${normalized.actives.trend > 0 ? '▲' : '▼'} ${Math.abs(normalized.actives.trend).toFixed(1)}% |
| Avg Weekly Churn Rate | ${avgChurn}% | — |
| Trial Conversion Rate | ${avgTCR}% avg | — |
| New MRR (4wk avg) | $${avgNewMrr}/wk | — |
| Churned MRR (4wk avg) | $${avgChurnedMrr}/wk | — |

---

## Executive Summary

${generateSummary(appName, normalized, flags, score)}

---

## 🚩 Red Flags

${flags.length === 0 ? '✅ No critical flags detected.' : flags.map(f => `### ${f.severity === 'HIGH' ? '🔴' : '🟠'} ${f.flag}\n${f.implication}`).join('\n\n')}

---

## 📋 Recommendations

${recs.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}

---

## 📊 Trend Analysis

### MRR Movement (Last 4 Weeks)
New MRR inflows vs outflows are the engine of subscription health:
${recentNew.map((v, i) => `- Week of ${v.date}: **+$${v.value.toFixed(0)}** new | **-$${recentChurned[i]?.value.toFixed(0) || '?'}** churned | Net: $${(v.value - (recentChurned[i]?.value || 0)).toFixed(0)}`).join('\n')}

### Trial Conversion Rate
${normalized.trialConversion.values.slice(-6).map(v => `- ${v.date}: **${v.value.toFixed(1)}%**`).join('\n')}

---

*RC Pulse is an open-source tool built on RevenueCat's Charts API.*
*Authored by OmarOS, an AI agent. Operator: Omar Abbasi.*
*Disclosure: This report was generated autonomously as part of RevenueCat's Agentic AI Developer Advocate application process.*
`;
}

function generateSummary(appName, normalized, flags, score) {
  const mrrTrend = normalized.mrr.trend;
  const hasChurnProblem = flags.some(f => f.flag.includes('Churned MRR'));

  if (score >= 70) {
    return `${appName} is in solid health. MRR is stable with a ${mrrTrend > 0 ? 'positive' : 'slight negative'} trend, and churn is within normal range for a mature subscription app. The primary opportunity is improving trial conversion consistency.`;
  }

  if (hasChurnProblem) {
    const recentChurned = normalized.mrrMovement.churnedMrr.slice(-4);
    const recentNew = normalized.mrrMovement.newMrr.slice(-4);
    const avgNew = recentNew.reduce((s, v) => s + v.value, 0) / recentNew.length;
    const avgChurned = recentChurned.reduce((s, v) => s + v.value, 0) / recentChurned.length;
    return `${appName} has a quiet churn problem. Weekly churned MRR ($${avgChurned.toFixed(0)}) is outpacing new MRR ($${avgNew.toFixed(0)}), creating a slow but compounding decline. The business is acquiring subscribers — it's not retaining them long enough. This is the key lever to address before investing further in top-of-funnel growth.`;
  }

  return `${appName}'s subscription business shows a gradual decline in core metrics. MRR has drifted ${Math.abs(mrrTrend).toFixed(1)}% over the analysis period. The pattern suggests structural subscriber decay rather than an acute event — which makes it easier to address with targeted retention tactics.`;
}

module.exports = { generateMarkdownReport, healthScore, detectRedFlags };
