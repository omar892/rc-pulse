#!/usr/bin/env node
/**
 * RC Pulse — AI-powered subscription health monitor for RevenueCat
 * Usage: npx rc-pulse --key sk_xxx [--days 90] [--format markdown|json]
 *
 * Built by OmarOS (AI agent). Operator: Omar Abbasi.
 * Disclosure: This tool was built as part of RevenueCat's Agentic AI Developer Advocate application.
 */

const { program } = require('commander');
const { getProjects, getOverviewMetrics, getAllCharts } = require('./api/client');
const { normalizeAll } = require('./analysis/normalize');
const { generateMarkdownReport } = require('./analysis/report');
const fs = require('fs');

program
  .name('rc-pulse')
  .description('AI-powered subscription health monitor using RevenueCat Charts API')
  .version('1.0.0')
  .requiredOption('--key <apiKey>', 'RevenueCat API key (Charts API key with read access)')
  .option('--days <number>', 'Number of days of history to analyze', '90')
  .option('--format <type>', 'Output format: markdown or json', 'markdown')
  .option('--output <file>', 'Save output to file instead of stdout')
  .option('--project <id>', 'Specific project ID (auto-detected if omitted)')
  .option('--watch <hours>', 'Re-run every N hours and print updated report (use with --output for file updates)')
  .option('--webhook <url>', 'Post report to Slack/Discord webhook URL after each run (use with --watch)');

program.parse();
const opts = program.opts();

function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - parseInt(days));
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

function log(msg) {
  process.stderr.write(msg + '\n');
}

async function main() {
  log('🔍 RC Pulse — Connecting to RevenueCat...');

  // Get project
  let projectId = opts.project;
  let appName = 'Your App';

  if (!projectId) {
    log('   → Fetching projects...');
    const projects = await getProjects(opts.key);
    if (!projects.items || projects.items.length === 0) {
      console.error('No projects found for this API key.');
      process.exit(1);
    }
    projectId = projects.items[0].id;
    appName = projects.items[0].name;
    log(`   → Found: ${appName} (${projectId})`);
  }

  // Get overview
  log('   → Fetching overview metrics...');
  const overview = await getOverviewMetrics(opts.key, projectId);
  const mrrMetric = overview.metrics?.find(m => m.id === 'mrr');
  if (mrrMetric) log(`   → Current MRR: $${mrrMetric.value?.toFixed(0)}`);

  // Get chart data
  const { startDate, endDate } = getDateRange(opts.days);
  log(`   → Pulling ${opts.days} days of chart data (${startDate} → ${endDate})`);
  log('   → This takes ~45 seconds to respect API rate limits...');

  const charts = await getAllCharts(opts.key, projectId, { resolution: 'week', startDate, endDate },
    (chart, i, total) => log(`   [${i}/${total}] ${chart}`)
  );

  // Normalize and analyze
  log('   → Analyzing data...');
  const normalized = normalizeAll(charts);

  // Generate output
  let output;
  if (opts.format === 'json') {
    output = JSON.stringify({ appName, overview: overview.metrics, normalized }, null, 2);
  } else {
    output = generateMarkdownReport(appName, normalized, charts);
  }

  if (opts.output) {
    fs.writeFileSync(opts.output, output);
    log(`\n✅ Report saved to ${opts.output}`);
  } else {
    process.stdout.write(output);
  }
}

async function runOnce() {
  await main();
}

async function runWatch(intervalHours) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  log(`👁  Watch mode: running every ${intervalHours}h`);
  while (true) {
    const start = Date.now();
    await main().catch(err => log(`Error: ${err.message}`));
    const elapsed = Date.now() - start;
    const wait = Math.max(0, intervalMs - elapsed);
    log(`\n⏱  Next run in ${intervalHours}h — ${new Date(Date.now() + wait).toLocaleTimeString()}`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

const watchHours = opts.watch ? parseFloat(opts.watch) : null;
if (watchHours) {
  runWatch(watchHours).catch(err => { console.error(err.message); process.exit(1); });
} else {
  runOnce().catch(err => { console.error('Error:', err.message); process.exit(1); });
}
