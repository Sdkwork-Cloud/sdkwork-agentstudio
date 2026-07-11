import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-agentstudio-pc-dashboard is implemented as a dedicated local feature package', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-agentstudio-pc-dashboard/package.json',
  );
  const indexSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/index.ts');

  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/Dashboard.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/Usage.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/pages/Dashboard.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/pages/UsageWorkspace.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/services/index.ts'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.ts'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/services/usageWorkspaceService.ts'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-dashboard/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/agentstudio-pc-studio-dashboard']);
  assert.equal(pkg.dependencies?.['@sdkwork/agentstudio-pc-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/agentstudio-pc-i18n'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/agent-studio-dashboard/);
  assert.match(indexSource, /\.\/Dashboard/);
  assert.match(indexSource, /\.\/Usage/);
  assert.match(indexSource, /\.\/services\/dashboardService/);
  assert.match(indexSource, /\.\/services\/usageWorkspaceService/);
});

runTest('sdkwork-agentstudio-pc-dashboard keeps the gateway-backed usage workspace in the shared dashboard package', () => {
  const usageExportSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/Usage.tsx');
  const usagePageSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/pages/UsageWorkspace.tsx');
  const usageServiceSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/services/usageWorkspaceService.ts');
  const enLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/en.json');
  const zhLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json');
  const enDashboardLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/en/dashboard.json');
  const zhDashboardLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh/dashboard.json');

  assert.match(usageExportSource, /UsageWorkspace/);
  assert.match(usagePageSource, /usageWorkspaceService/);
  assert.match(usagePageSource, /dashboard\.usage\.page\.eyebrow/);
  assert.match(usagePageSource, /dashboard\.usage\.page\.title/);
  assert.match(usagePageSource, /dashboard\.usage\.sections\.sessionTimeline/);
  assert.match(usagePageSource, /dashboard\.usage\.sections\.sessionLogs/);
  assert.match(usagePageSource, /dashboard\.usage\.metrics\.totalTokens/);
  assert.match(usagePageSource, /dashboard\.usage\.metrics\.totalCost/);
  assert.doesNotMatch(usagePageSource, /OpenClaw Usage/);
  assert.match(usagePageSource, /loadUsageSnapshot/);
  assert.match(usagePageSource, /loadSessionDetail/);
  assert.match(
    usagePageSource,
    /setSelectedSessionKeys\(\(current\) =>\s*\(current\.length === 0 \? current : \[\]\)\)/,
  );
  assert.equal(typeof enLocale.dashboard?.usage?.page?.eyebrow, 'string');
  assert.equal(typeof zhLocale.dashboard?.usage?.page?.eyebrow, 'string');
  assert.doesNotMatch(enLocale.dashboard.usage.page.eyebrow, /OpenClaw/i);
  assert.doesNotMatch(enLocale.dashboard.usage.page.description, /OpenClaw/i);
  assert.doesNotMatch(enLocale.dashboard.usage.page.emptyTitle, /OpenClaw/i);
  assert.doesNotMatch(enLocale.dashboard.usage.page.emptyDescription, /OpenClaw/i);
  assert.doesNotMatch(enLocale.dashboard.usage.sections.sessionLogsDescription, /OpenClaw/i);
  assert.match(zhLocale.dashboard.usage.page.eyebrow, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.usage.page.description, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.usage.page.emptyTitle, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.usage.page.emptyDescription, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.usage.sections.sessionLogsDescription, /[\p{Script=Han}]/u);
  assert.equal(
    enDashboardLocale.usage.page.eyebrow,
    enLocale.dashboard.usage.page.eyebrow,
  );
  assert.equal(
    enDashboardLocale.usage.page.description,
    enLocale.dashboard.usage.page.description,
  );
  assert.equal(
    enDashboardLocale.usage.page.emptyTitle,
    enLocale.dashboard.usage.page.emptyTitle,
  );
  assert.equal(
    enDashboardLocale.usage.page.emptyDescription,
    enLocale.dashboard.usage.page.emptyDescription,
  );
  assert.equal(
    enDashboardLocale.usage.sections.sessionLogsDescription,
    enLocale.dashboard.usage.sections.sessionLogsDescription,
  );
  assert.equal(
    zhDashboardLocale.usage.page.eyebrow,
    zhLocale.dashboard.usage.page.eyebrow,
  );
  assert.equal(
    zhDashboardLocale.usage.page.description,
    zhLocale.dashboard.usage.page.description,
  );
  assert.equal(
    zhDashboardLocale.usage.page.emptyTitle,
    zhLocale.dashboard.usage.page.emptyTitle,
  );
  assert.equal(
    zhDashboardLocale.usage.page.emptyDescription,
    zhLocale.dashboard.usage.page.emptyDescription,
  );
  assert.equal(
    zhDashboardLocale.usage.sections.sessionLogsDescription,
    zhLocale.dashboard.usage.sections.sessionLogsDescription,
  );
  assert.match(usageServiceSource, /getGatewaySessionUsage/);
  assert.match(usageServiceSource, /getUsageCost/);
  assert.match(usageServiceSource, /getGatewaySessionUsageTimeseries/);
  assert.match(usageServiceSource, /getGatewaySessionUsageLogs/);
  assert.match(usageServiceSource, /transportKind === 'openclawGatewayWs'/);
  assert.doesNotMatch(usageServiceSource, /runtimeKind === 'openclaw'/);
  assert.doesNotMatch(usagePageSource, /@sdkwork\/claw-shell/);
  assert.doesNotMatch(usagePageSource, /@sdkwork\/claw-web/);
  assert.doesNotMatch(usagePageSource, /@sdkwork\/claw-desktop/);
});

runTest('sdkwork-agentstudio-pc-dashboard aggregates shared runtime data into a control-plane snapshot', () => {
  const serviceSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.ts');

  assert.match(serviceSource, /listInstances/);
  assert.match(serviceSource, /getInstanceDetail/);
  assert.match(serviceSource, /detail\?\.workbench/);
  assert.match(serviceSource, /cronTasks\.tasks/);
  assert.match(serviceSource, /workbench\?\.channels/);
  assert.match(serviceSource, /workbench\?\.skills/);
  assert.match(serviceSource, /workbench\?\.agents/);
  assert.match(serviceSource, /calculateWorkspaceHealthScore/);
  assert.match(serviceSource, /calculateCapabilityCoverageScore/);
  assert.match(serviceSource, /tokenAnalytics/);
  assert.match(serviceSource, /usageTrend/);
  assert.match(serviceSource, /granularity/);
  assert.match(serviceSource, /rangeMode/);
  assert.match(serviceSource, /modelBreakdown/);
  assert.match(serviceSource, /cacheCreationTokens/);
  assert.match(serviceSource, /cacheReadTokens/);
  assert.match(serviceSource, /revenueAnalytics/);
  assert.match(serviceSource, /dashboardCommerceService/);
  assert.match(serviceSource, /getCommerceSnapshot/);
  assert.match(serviceSource, /createEmptyDashboardCommerceSnapshot/);
  assert.match(serviceSource, /createDashboardService/);
  assert.match(serviceSource, /usageRecordsApi/);
  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.match(serviceSource, /businessSummary/);
  assert.match(serviceSource, /tokenSummary/);
  assert.match(serviceSource, /recentApiCalls/);
  assert.match(serviceSource, /recentRevenueRecords/);
  assert.match(serviceSource, /productPerformance/);
  assert.doesNotMatch(serviceSource, /PRODUCT_PROFILES/);
});

runTest('sdkwork-agentstudio-pc-dashboard recommendations target retained workspace routes', () => {
  const serviceSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.ts');

  assert.doesNotMatch(serviceSource, /actionPath: '\/market'/);
  assert.match(serviceSource, /actionPath: '\/agents'/);
});

runTest('sdkwork-agentstudio-pc-dashboard renders a professional operator cockpit instead of a placeholder page', () => {
  const pageSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/pages/Dashboard.tsx');
  const chartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/TokenTrendChart.tsx');

  assert.doesNotMatch(pageSource, /dashboard\.page\.title/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.eyebrow/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.description/);
  assert.match(chartSource, /dashboard\.filters\.granularity/);
  assert.match(chartSource, /dashboard\.filters\.range/);
  assert.match(chartSource, /dashboard\.filters\.sevenDays/);
  assert.match(chartSource, /dashboard\.filters\.month/);
  assert.match(chartSource, /dashboard\.filters\.custom/);
  assert.doesNotMatch(pageSource, /dashboard\.filters\.granularity/);
  assert.doesNotMatch(pageSource, /dashboard\.filters\.range/);
  assert.match(pageSource, /dashboard\.sections\.tokenIntelligence/);
  assert.match(pageSource, /dashboard\.sections\.modelDistribution/);
  assert.match(pageSource, /dashboard\.sections\.activityWorkbench/);
  assert.match(pageSource, /dashboard\.series\.totalTokens/);
  assert.match(pageSource, /dashboard\.series\.inputTokens/);
  assert.match(pageSource, /dashboard\.series\.outputTokens/);
  assert.match(pageSource, /dashboard\.series\.cacheCreation/);
  assert.match(pageSource, /dashboard\.series\.cacheRead/);
  assert.match(pageSource, /dashboard\.table\.modelName/);
  assert.match(pageSource, /dashboard\.table\.requestCount/);
  assert.match(pageSource, /dashboard\.table\.token/);
  assert.match(pageSource, /dashboard\.table\.actualAmount/);
  assert.match(pageSource, /dashboard\.table\.standardAmount/);
  assert.match(pageSource, /dashboard\.metrics\.revenue/);
  assert.match(pageSource, /dashboard\.metrics\.tokenUsage/);
  assert.match(pageSource, /dashboard\.metrics\.businessConversion/);
  assert.match(pageSource, /dashboard\.labels\.today/);
  assert.match(pageSource, /dashboard\.labels\.week/);
  assert.match(pageSource, /dashboard\.labels\.month/);
  assert.match(pageSource, /dashboard\.labels\.year/);
  assert.match(pageSource, /dashboard\.labels\.dailyRequests/);
  assert.match(pageSource, /dashboard\.labels\.dailyTokens/);
  assert.match(pageSource, /dashboard\.labels\.dailySpend/);
  assert.match(pageSource, /dashboard\.sections\.revenueTrend/);
  assert.match(pageSource, /dashboard\.sections\.revenueDistribution/);
  assert.match(pageSource, /dashboard\.tabs\.recentApiCalls/);
  assert.match(pageSource, /dashboard\.tabs\.recentRevenueRecords/);
  assert.match(pageSource, /dashboard\.tabs\.productPerformance/);
  assert.match(pageSource, /dashboard\.tabs\.alerts/);
  assert.doesNotMatch(pageSource, /dashboard\.products\./);
  assert.doesNotMatch(pageSource, /navigate\('\/instances'\)/);
  assert.doesNotMatch(pageSource, /navigate\('\/chat'\)/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.openInstances/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.openChat/);
  assert.doesNotMatch(pageSource, /dashboard\.page\.refresh/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.health/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.spend/);
  assert.doesNotMatch(pageSource, /dashboard\.hero\.tokens/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.healthScore/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.capabilityCoverage/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.instanceAvailability/);
  assert.doesNotMatch(pageSource, /dashboard\.metrics\.automationCadence/);
});

runTest('sdkwork-agentstudio-pc-dashboard avoids garbled copy and redundant operator summary patterns', () => {
  const pageSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/pages/Dashboard.tsx');

  assert.doesNotMatch(pageSource, /鈫\?/);
  assert.doesNotMatch(pageSource, /<SectionHeader[\s\S]*title=\{t\('dashboard\.page\.title'\)\}/);
  assert.match(pageSource, /ModelDistributionChart/);
  assert.doesNotMatch(pageSource, /formatTokens\(row\.requestCount\)/);
  assert.match(pageSource, /formatInteger\(row\.requestCount\)/);
});

runTest('sdkwork-agentstudio-pc-dashboard keeps Chinese analytics copy intact', () => {
  const zhLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json');

  assert.match(zhLocale.dashboard.page.title, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.page.title, /\?/);
  assert.match(zhLocale.dashboard.sections.tokenIntelligence, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.tokenIntelligence, /\?/);
  assert.match(zhLocale.dashboard.sections.modelDistribution, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.modelDistribution, /\?/);
  assert.match(zhLocale.dashboard.charts.tokenUsageTrend, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.charts.tokenUsageTrend, /\?/);
  assert.match(zhLocale.dashboard.sections.revenueTrend, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.revenueTrend, /\?/);
  assert.match(zhLocale.dashboard.sections.revenueDistribution, /[\p{Script=Han}]/u);
  assert.doesNotMatch(zhLocale.dashboard.sections.revenueDistribution, /\?/);
  assert.match(zhLocale.dashboard.sections.activityWorkbench, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.tabs.recentApiCalls, /[\p{Script=Han}]/u);
  assert.match(zhLocale.dashboard.tabs.recentRevenueRecords, /[\p{Script=Han}]/u);
});

runTest('sdkwork-agentstudio-pc-dashboard token trend chart tolerates missing series input', () => {
  const chartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /points\s*=\s*\[\]/);
  assert.match(chartSource, /series\s*=\s*\[\]/);
});

runTest('sdkwork-agentstudio-pc-dashboard token trend chart uses the available card width more aggressively', () => {
  const pageSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/pages/Dashboard.tsx');
  const chartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/TokenTrendChart.tsx');
  const revenueChartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/RevenueTrendChart.tsx');

  assert.doesNotMatch(
    pageSource,
    /rounded-\[1\.6rem\] border border-zinc-200\/70 bg-white\/70 p-4[\s\S]*<TokenTrendChart/,
  );
  assert.match(chartSource, /new ResizeObserver/);
  assert.match(chartSource, /const width = Math\.max\(chartWidth, 320\);/);
  assert.match(revenueChartSource, /const width = Math\.max\(chartWidth, 320\);/);
  assert.match(chartSource, /const chartPaddingX = width < 520 \? 12 : 16;/);
  assert.match(revenueChartSource, /const chartPaddingX = width < 520 \? 12 : 16;/);
  assert.match(chartSource, /const plotLeft = chartPaddingX \+ yAxisLabelWidth;/);
  assert.match(chartSource, /const targetXAxisLabelCount = width < 520 \? 4 : width < 760 \? 6 : 8;/);
  assert.match(revenueChartSource, /const targetXAxisLabelCount = width < 520 \? 4 : width < 760 \? 6 : 8;/);
  assert.match(chartSource, /className="h-\[20rem\] w-full sm:h-\[22rem\]"/);
  assert.match(revenueChartSource, /className="h-\[20rem\] w-full sm:h-\[22rem\]"/);
  assert.doesNotMatch(chartSource, /w-\[calc\(100%\+1rem\)\]/);
});

runTest('sdkwork-agentstudio-pc-dashboard keeps advanced time-range configuration inside a popup instead of inline chart controls', () => {
  const chartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /DialogContent/);
  assert.match(chartSource, /DialogTitle/);
  assert.match(chartSource, /isRangeDialogOpen/);
  assert.match(chartSource, /draftRangeMode/);
  assert.match(chartSource, /dashboard\.filters\.configureRange/);
  assert.doesNotMatch(chartSource, /\{controls\.rangeMode === 'month' \? \(/);
  assert.doesNotMatch(chartSource, /\{controls\.rangeMode === 'custom' \? \(/);
});

runTest('sdkwork-agentstudio-pc-dashboard lets chart filters wrap on tablet widths before locking into a desktop row', () => {
  const chartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/TokenTrendChart.tsx');

  assert.match(chartSource, /sm:flex-row sm:flex-wrap sm:items-end xl:flex-nowrap/);
  assert.match(chartSource, /sm:min-w-\[11rem\] sm:flex-1 xl:w-44 xl:flex-none/);
  assert.match(chartSource, /sm:min-w-\[14rem\] sm:flex-1 xl:w-56 xl:flex-none/);
  assert.match(chartSource, /SelectTrigger className="mt-2 h-11 w-full rounded-2xl/);
  assert.match(chartSource, /className="mt-2 h-11 w-full justify-between rounded-2xl/);
  assert.doesNotMatch(chartSource, /SelectTrigger className="mt-2 h-auto/);
  assert.doesNotMatch(chartSource, /className="mt-2 h-auto w-full items-center justify-between/);
});

runTest('sdkwork-agentstudio-pc-dashboard prefers reflow over text compression at intermediate viewport widths', () => {
  const pageSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/pages/Dashboard.tsx');
  const summaryCardSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/DashboardSummaryCard.tsx');
  const sectionHeaderSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/SectionHeader.tsx');
  const ringChartSource = read('packages/sdkwork-agentstudio-pc-dashboard/src/components/DistributionRingChart.tsx');

  assert.match(pageSource, /xl:grid-cols-2 2xl:grid-cols-3/);
  assert.match(pageSource, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2/);
  assert.match(pageSource, /grid gap-6 2xl:grid-cols-\[1\.35fr_0\.95fr\]/);
  assert.match(pageSource, /mt-6 grid gap-5 xl:grid-cols-\[minmax\(16rem,0\.82fr\)_minmax\(0,1\.18fr\)\]/);
  assert.match(summaryCardSource, /min-w-0 relative overflow-hidden/);
  assert.match(summaryCardSource, /flex-col gap-4 sm:flex-row/);
  assert.match(sectionHeaderSource, /lg:flex-row lg:items-end lg:justify-between/);
  assert.match(ringChartSource, /className="h-auto w-full max-w-\[15rem\]"/);
});
