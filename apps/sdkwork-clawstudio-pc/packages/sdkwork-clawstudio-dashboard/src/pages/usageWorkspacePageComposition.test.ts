import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const exportSource = readFileSync(new URL('../Usage.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./UsageWorkspace.tsx', import.meta.url), 'utf8');

await runTest(
  'Usage workspace stays in the dashboard package and is wired through the shared usage service',
  () => {
    assert.match(exportSource, /export \{ UsageWorkspacePage as UsageWorkspace \} from '\.\/pages\/UsageWorkspace\.tsx';/);
    assert.match(
      pageSource,
      /import \{[\s\S]*usageWorkspaceService[\s\S]*\} from '\.\.\/services';/,
    );
    assert.match(pageSource, /dashboard\.usage\.page\.title/);
    assert.match(pageSource, /dashboard\.usage\.filters\.instance/);
    assert.match(pageSource, /dashboard\.usage\.filters\.timeZone/);
    assert.match(pageSource, /dashboard\.usage\.filters\.search/);
    assert.match(pageSource, /dashboard\.usage\.filters\.query/);
    assert.match(pageSource, /dashboard\.usage\.filters\.applyQuery/);
    assert.match(pageSource, /dashboard\.usage\.filters\.clearQuery/);
    assert.match(pageSource, /dashboard\.usage\.filters\.selectedDays/);
    assert.match(pageSource, /dashboard\.usage\.filters\.visibleColumns/);
    assert.match(pageSource, /dashboard\.usage\.filters\.logRoles/);
    assert.match(pageSource, /dashboard\.usage\.filters\.logTools/);
    assert.match(pageSource, /dashboard\.usage\.filters\.sort/);
    assert.match(pageSource, /dashboard\.usage\.sections\.sessions/);
    assert.match(pageSource, /dashboard\.usage\.sections\.dailyBreakdown/);
    assert.match(pageSource, /dashboard\.usage\.sections\.sessionDetail/);
    assert.match(pageSource, /dashboard\.usage\.sections\.sessionLogs/);
    assert.match(pageSource, /dashboard\.usage\.sections\.sessionTimeline/);
    assert.match(pageSource, /dashboard\.usage\.metrics\.totalTokens/);
    assert.match(pageSource, /dashboard\.usage\.metrics\.totalCost/);
    assert.match(pageSource, /dashboard\.usage\.metrics\.sessionCount/);
    assert.match(pageSource, /dashboard\.usage\.metrics\.errorCount/);
    assert.match(pageSource, /loadUsageSnapshot/);
    assert.match(pageSource, /loadSessionDetail/);
    assert.match(pageSource, /applyShiftRangeSelection/);
    assert.match(pageSource, /filterUsageWorkspaceSessionsByQuery/);
    assert.match(pageSource, /filterUsageWorkspaceLogs/);
    assert.doesNotMatch(pageSource, /@sdkwork\/claw-shell/);
    assert.doesNotMatch(pageSource, /@sdkwork\/claw-web/);
    assert.doesNotMatch(pageSource, /@sdkwork\/claw-desktop/);
  },
);
