# RC Pulse

**AI-powered subscription health monitor for RevenueCat apps.**

> *Built by OmarOS, an autonomous AI agent operated by Omar Abbasi.*
> *Disclosure: This project was created as part of RevenueCat's Agentic AI Developer & Growth Advocate application process.*

---

RC Pulse connects to RevenueCat's Charts API, pulls your subscription metrics, and generates a structured health report — complete with a health score, red flag detection, and actionable recommendations. No dashboards to interpret. No spreadsheets to maintain. One command, one report.

**[→ Live Dashboard (Dark Noise demo)](https://rc-pulse.vercel.app)**

---

## What It Does

RevenueCat gives you the data. RC Pulse tells you what it means.

```
$ npx rc-pulse --key sk_xxx --days 90

🔍 RC Pulse — Connecting to RevenueCat...
   → Found: Dark Noise (proj058a6330)
   → Current MRR: $4545
   → Pulling 90 days of chart data...

# RC Pulse — Subscription Health Report
> Dark Noise · Generated 2026-04-03

## 🟡 Health Score: 67/100 — Stable

| Metric              | Current  | Trend        |
|---------------------|----------|--------------|
| MRR                 | $4,545   | ▼ 1.2%      |
| Active Subscribers  | 2,531    | ▼ 1.8%      |
| Avg Churn Rate      | 1.68%    | —            |
| Trial Conversion    | 58% avg  | —            |
| New MRR (4wk avg)   | $65/wk   | —            |
| Churned MRR (4wk)   | $80/wk   | —            |

## 🚩 Red Flags
🔴 Churned MRR ($80/wk) exceeds New MRR ($65/wk)
   → You are losing subscribers faster than you acquire them.
```

---

## Quick Start

```bash
# Install globally
npm install -g rc-pulse

# Or run directly (no install)
npx rc-pulse --key YOUR_RC_API_KEY

# Save report to file
npx rc-pulse --key YOUR_RC_API_KEY --days 90 --output report.md

# Get raw JSON
npx rc-pulse --key YOUR_RC_API_KEY --format json
```

**Requirements:**
- A RevenueCat API key with Charts API permissions (`charts_metrics:overview:read` and `charts_metrics:charts:read`)
- Node.js v18+

---

## Architecture

```
rc-pulse/
├── src/
│   ├── index.js          # CLI entry point (commander)
│   ├── api/
│   │   └── client.js     # RevenueCat API client
│   │                       rate-limit-aware (14 req/min)
│   │                       exponential backoff on 429s
│   └── analysis/
│       ├── normalize.js  # Time-series normalization
│       │                   rolling averages, period-over-period
│       │                   trend detection
│       └── report.js     # Health scoring + report generation
│                           deterministic scoring engine
│                           anomaly + contradiction detection
│                           markdown output
├── dashboard/
│   └── index.html        # Single-file web dashboard (Chart.js)
└── examples/
    └── dark-noise-report.md  # Real output from Dark Noise data
```

**How the health score works (0–100):**

| Factor | Max Impact |
|--------|-----------|
| MRR trend | ±25 pts |
| Churn rate vs benchmarks | ±20 pts |
| Churned MRR vs New MRR ratio | ±20 pts |
| Trial conversion rate | ±15 pts |
| Active subscriber trend | ±10 pts |
| LTV trend | ±5 pts |

---

## How Agents Use This

RC Pulse was designed to be part of an autonomous agent's weekly workflow:

**Weekly cron (node-cron or system cron):**
```bash
# Add to crontab: run every Monday at 8am
0 8 * * 1 npx rc-pulse --key $RC_KEY --output ~/reports/weekly.md
```

**Slack/Discord webhook delivery:**
```bash
REPORT=$(npx rc-pulse --key $RC_KEY --days 7)
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  -d "{\"text\": \"\`\`\`${REPORT}\`\`\`\"}"
```

**CI/CD health gate:**
```yaml
# .github/workflows/subscription-health.yml
- name: Check subscription health
  run: |
    SCORE=$(npx rc-pulse --key $RC_KEY --format json | jq '.score')
    if [ "$SCORE" -lt "50" ]; then
      echo "Health score below threshold: $SCORE"
      exit 1
    fi
```

---

## Example Output

See [`examples/dark-noise-report.md`](examples/dark-noise-report.md) for a real report generated from Dark Noise's production data.

---

## License

MIT — fork it, ship it, break it, improve it.

---

*RC Pulse | Built with RevenueCat Charts API | OmarOS (AI agent) × Omar Abbasi*
