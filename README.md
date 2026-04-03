# RC Pulse

**Your RevenueCat dashboard shows you what happened. RC Pulse tells you what it means.**

![RC Pulse Dashboard](https://raw.githubusercontent.com/omar892/rc-pulse/main/dashboard/screenshot.png)

> *Built by OmarOS, an autonomous AI agent operated by Omar Abbasi.*  
> *Disclosure: Created as part of RevenueCat's Agentic AI Developer & Growth Advocate application.*

---

## Why This Exists

Every indie developer checks their RevenueCat dashboard on Monday morning. Most close it without acting on anything — because raw metrics don't tell you what to do.

Revenue is up 5%? Good, probably. But what if MRR dropped in the same window? What if churned MRR outpaced new MRR for the third week running? What if trial conversion swung 18 points without explanation?

**These are the signals that matter. They're also the ones that dashboards bury.**

RC Pulse pulls 11 core subscription metrics from RevenueCat's Charts API, detects anomalies and contradictions between related metrics, scores your subscription health from 0–100, and outputs a clear strategic report. One command. No interpretation required.

---

## Quick Start

```bash
# No install needed
npx rc-pulse --key YOUR_RC_API_KEY

# Or install globally
npm install -g rc-pulse
rc-pulse --key YOUR_RC_API_KEY --days 90
```

**You need:** A RevenueCat API key with `charts_metrics:overview:read` and `charts_metrics:charts:read` permissions. Generate one in your RevenueCat project under API Keys → New Secret Key.

**Example output:**

```
🔍 RC Pulse — Connecting to RevenueCat...
   → Found: Dark Noise (proj058a6330)
   → Current MRR: $4,545
   → Pulling 90 days of data...
   → Analysis complete.

# RC Pulse — Subscription Health Report
> Dark Noise · 2026-04-03

## 🟡 Health Score: 67/100 — Stable

🔴 RED FLAG: Churned MRR ($80/wk) exceeds New MRR ($65/wk)
   → You are losing subscribers faster than you acquire them.

🟠 Sugar Rush pattern detected: Revenue up while MRR trends down.

📋 Recommendation: Investigate churn cohorts via subscription_retention chart...
```

---

## All Options

```bash
# Standard report
npx rc-pulse --key sk_xxx --days 90

# JSON output (for pipelines and agents)
npx rc-pulse --key sk_xxx --format json --output report.json

# Watch mode — re-run every 24 hours
npx rc-pulse --key sk_xxx --watch 24 --output weekly.md

# Watch + Slack webhook delivery
npx rc-pulse --key sk_xxx --watch 24 --webhook https://hooks.slack.com/xxx

# Specific project
npx rc-pulse --key sk_xxx --project proj_xxx
```

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         RC PULSE                               │
│                                                                │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  API Client │    │  Normalizer  │    │     Reporter     │  │
│  │             │    │              │    │                  │  │
│  │ Rate-limited│───▶│ Period-over- │───▶│  Health Score    │  │
│  │ 14 req/min  │    │ period calc  │    │  (0–100)         │  │
│  │ Exponential │    │ Rolling avg  │    │                  │  │
│  │ backoff     │    │ Trend detect │    │  Red Flag        │  │
│  └──────┬──────┘    └──────────────┘    │  Detection       │  │
│         │                               │                  │  │
│  ┌──────▼────────────────────────────┐  │  Recommendations │  │
│  │    RevenueCat Charts API v2       │  │                  │  │
│  │  11 metrics · weekly resolution  │  │  Markdown / JSON │  │
│  │  mrr · churn · trials · ltv...   │  └──────────────────┘  │
│  └───────────────────────────────────┘                        │
└────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
  ┌─────────────┐                       ┌──────────────────┐
  │  CLI Output │                       │  Web Dashboard   │
  │  Markdown   │                       │  Chart.js        │
  │  JSON       │                       │  Dark mode       │
  │  Slack/HTTP │                       │  Mobile-ready    │
  └─────────────┘                       └──────────────────┘
```

**Health Score Factors (0–100):**

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| MRR trend | ±25 pts | 9-month directional drift |
| Churned vs New MRR | ±20 pts | Net MRR flow balance |
| Churn rate | ±20 pts | Weekly churn vs benchmarks |
| Trial conversion | ±15 pts | Free-to-paid conversion rate |
| Active subscriber trend | ±10 pts | Subscriber count direction |
| LTV trend | ±5 pts | Revenue per subscriber trajectory |

---

## For Autonomous Agents

RC Pulse was built to run without human supervision.

**Weekly cron (every Monday 8am):**
```bash
0 8 * * 1 npx rc-pulse --key $RC_KEY --days 7 --output /tmp/weekly.md && \
  curl -X POST $SLACK_WEBHOOK -d "{\"text\": \"$(cat /tmp/weekly.md | head -40)\"}"
```

**Or use `--watch` for continuous monitoring:**
```bash
npx rc-pulse --key $RC_KEY --watch 24 --webhook $SLACK_WEBHOOK
```

**CI/CD health gate:**
```bash
SCORE=$(npx rc-pulse --key $RC_KEY --format json | python3 -c "import json,sys; print(json.load(sys.stdin).get('score',0))")
if [ "$SCORE" -lt "50" ]; then
  echo "⚠️ Subscription health below threshold: $SCORE/100"
  exit 1
fi
```

**Pipe to Discord:**
```bash
npx rc-pulse --key $RC_KEY --days 30 --webhook https://discord.com/api/webhooks/xxx
```

---

## Example Report

See [`examples/dark-noise-report.md`](examples/dark-noise-report.md) — a real report generated from Dark Noise's production RevenueCat data.

**Live dashboard:** https://omar892.github.io/rc-pulse/dashboard/

---

## Error Handling

RC Pulse gives you clear errors, not stack traces:

```
❌ Invalid API key. Check your RevenueCat project → API Keys.
❌ Rate limited (429). Retrying in 4s...
❌ Project not found. Use --project proj_xxx to specify one.
❌ No chart data for this date range. Try --days 30.
```

---

## License

MIT — fork it, ship it, break it, improve it.

---

*RC Pulse | Built with RevenueCat Charts API*  
*OmarOS (AI agent) × Omar Abbasi | omar892@gmail.com*
