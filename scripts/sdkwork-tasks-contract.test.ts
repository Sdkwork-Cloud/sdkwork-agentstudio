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

runTest('sdkwork-claw-tasks is implemented locally instead of re-exporting claw-studio-tasks', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-tasks/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-tasks/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-tasks/src/services/index.ts');

  assert.ok(exists('packages/sdkwork-claw-tasks/src/Tasks.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/components/GlobalTaskManager.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/store/useTaskStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx'));
  assert.ok(exists('packages/sdkwork-claw-tasks/src/services/taskService.ts'));
  assert.ok(exists('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-tasks']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-instances']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-commons'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-tasks/);
  assert.match(indexSource, /\.\/Tasks/);
  assert.match(indexSource, /\.\/components\/GlobalTaskManager/);
  assert.match(indexSource, /\.\/store\/useTaskStore/);
  assert.match(indexSource, /taskService/);
  assert.doesNotMatch(indexSource, /\.test['"]/);
  assert.doesNotMatch(servicesIndexSource, /\.test['"]/);
});

runTest('sdkwork-claw-tasks routes cron CRUD through the shared manager and the real runtime bridges', () => {
  const serviceSource = read('packages/sdkwork-claw-core/src/services/taskService.ts');
  const runtimeServiceSource = read('packages/sdkwork-claw-core/src/services/taskRuntimeService.ts');
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');
  const pageSource = read('packages/sdkwork-claw-tasks/src/pages/Tasks.tsx');

  assert.match(serviceSource, /studio\.getInstanceDetail\(instanceId\)/);
  assert.match(serviceSource, /from '\.\/taskSurfaceSupport\.ts'/);
  assert.match(serviceSource, /resolveTaskCrudSurface\(detail\)/);
  assert.match(serviceSource, /return canManageTasks\(detail\) \? detail : null;/);
  assert.doesNotMatch(serviceSource, /isOpenClawDetail/);
  assert.doesNotMatch(serviceSource, /runtimeKind === 'openclaw'/);
  assert.match(serviceSource, /studio\.createInstanceTask\(/);
  assert.match(serviceSource, /studio\.updateInstanceTask\(/);
  assert.match(serviceSource, /studio\.cloneInstanceTask\(/);
  assert.match(serviceSource, /studio\.runInstanceTaskNow\(/);
  assert.match(serviceSource, /studio\.listInstanceTaskExecutions\(/);
  assert.match(serviceSource, /studio\.updateInstanceTaskStatus\(/);
  assert.match(serviceSource, /studio\.deleteInstanceTask\(/);
  assert.match(serviceSource, /openClawGatewayClient\.listWorkbenchCronJobs\(/);
  assert.match(serviceSource, /openClawGatewayClient\.addCronJob\(/);
  assert.match(serviceSource, /openClawGatewayClient\.updateCronJob\(/);
  assert.match(serviceSource, /openClawGatewayClient\.runCronJob\(/);
  assert.match(serviceSource, /openClawGatewayClient\.listWorkbenchCronRuns\(/);
  assert.match(serviceSource, /openClawGatewayClient\.removeCronJob\(/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
  assert.doesNotMatch(serviceSource, /const tasksData/);

  assert.match(runtimeServiceSource, /from '\.\/taskSurfaceSupport\.ts'/);
  assert.match(runtimeServiceSource, /supportsRuntimeTaskSurface\(detail\)/);
  assert.match(runtimeServiceSource, /runtimeTaskSurface: false/);
  assert.match(runtimeServiceSource, /runtimeTaskSurface: true/);
  assert.doesNotMatch(runtimeServiceSource, /openClawRuntime/);
  assert.doesNotMatch(runtimeServiceSource, /runtimeKind === 'openclaw'/);

  assert.match(managerSource, /taskRuntimeOverview\.runtimeTaskSurface/);
  assert.doesNotMatch(managerSource, /taskRuntimeOverview\.openClawRuntime/);

  assert.match(pageSource, /CronTasksManager/);
  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /instanceId=\{activeInstanceId \?\? undefined\}/);
  assert.doesNotMatch(pageSource, /taskService\.getTasks\(activeInstanceId\)/);
  assert.doesNotMatch(pageSource, /taskService\.(createTask|create)\(activeInstanceId,/);
});

runTest('sdkwork-claw-tasks shared manager keeps the refined task workspace and card actions', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /buildTaskCreateWorkspaceState/);
  assert.match(managerSource, /buildTaskCardState/);
  assert.match(managerSource, /buildTaskFormValuesFromTask/);
  assert.match(managerSource, /buildCreateTaskInput/);
  assert.match(managerSource, /OverlaySurface/);
  assert.match(managerSource, /taskService\.cloneTask\(/);
  assert.match(managerSource, /taskService\.runTaskNow\(/);
  assert.match(managerSource, /taskService\.listTaskExecutions\(/);
  assert.match(managerSource, /taskService\.updateTask\(/);
  assert.match(managerSource, /taskService\.updateTaskStatus\(/);
  assert.match(managerSource, /taskService\.deleteTask\(/);
});

runTest('sdkwork-claw-tasks shared manager uses the shared task catalog surface', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /TaskCatalog/);
  assert.match(managerSource, /TaskExecutionHistoryDrawer/);
  assert.match(managerSource, /getTaskToggleStatusTarget/);
  assert.doesNotMatch(managerSource, /<TaskRow/);
});

runTest('sdkwork-claw-tasks shared manager binds cron agent selection to the connected instance catalog', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');
  const dataSource = read('packages/sdkwork-claw-commons/src/components/cronTasksManagerData.ts');
  const coreServiceSource = read('packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.ts');

  assert.match(managerSource, /loadTaskStudioSnapshot/);
  assert.match(managerSource, /getAgentCatalog:\s*\(instanceId\)\s*=>/);
  assert.match(managerSource, /openClawAgentCatalogService\.getCatalog\(instanceId\)/);
  assert.match(dataSource, /getAgentCatalog:\s*\(instanceId:\s*string\)\s*=>\s*Promise<OpenClawAgentCatalog>/);
  assert.match(dataSource, /input\.getAgentCatalog\(input\.instanceId\)/);
  assert.match(managerSource, /taskRuntimeService\.getOverview\(instanceId\)/);
  assert.match(dataSource, /getTaskRuntimeOverview:\s*\(instanceId:\s*string\)\s*=>\s*Promise<TaskRuntimeOverview>/);
  assert.match(dataSource, /input\.getTaskRuntimeOverview\(input\.instanceId\)/);
  assert.match(managerSource, /buildTaskAgentSelectState/);
  assert.match(managerSource, /DEFAULT_TASK_AGENT_SELECT_VALUE/);
  assert.match(
    managerSource,
    /value === DEFAULT_TASK_AGENT_SELECT_VALUE \? '' : value/,
  );
  assert.match(managerSource, /agentIdDefaultOption/);
  assert.match(managerSource, /agentIdCatalogHelp/);
  assert.match(
    coreServiceSource,
    /readOpenClawConfigSnapshot\(configPath\)[\s\S]*\.catch\(\(\) => null\)/,
  );
  assert.match(coreServiceSource, /buildTaskAgentSelectState/);
});

runTest('sdkwork-claw-tasks runtime board copy is wired for the latest OpenClaw task and task-flow surfaces', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');
  const en = readJson<{ tasks: { page: { runtime?: Record<string, unknown> } } }>(
    'packages/sdkwork-claw-i18n/src/locales/en.json',
  );
  const zh = readJson<{ tasks: { page: { runtime?: Record<string, unknown> } } }>(
    'packages/sdkwork-claw-i18n/src/locales/zh.json',
  );

  const enRuntime = en.tasks.page.runtime;
  const zhRuntime = zh.tasks.page.runtime;

  assert.match(managerSource, /tasks\.page\.runtime\.taskBoard\.title/);
  assert.match(managerSource, /tasks\.page\.runtime\.taskFlows\.title/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.currentStep/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.notifyPolicy/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.owner/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.requesterOrigin/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.cancelRequestedAt/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.flowId/);
  assert.match(managerSource, /function openRuntimeTaskDetail\(/);
  assert.match(managerSource, /taskRuntimeService\.getRuntimeTaskDetail\(/);
  assert.match(managerSource, /renderRuntimeTaskDetailOverlay\(/);
  assert.match(managerSource, /function openTaskFlowDetail\(/);
  assert.match(managerSource, /taskRuntimeService\.getTaskFlowDetail\(/);
  assert.match(managerSource, /tasks\.page\.runtime\.taskBoard\.detail\.description/);
  assert.match(managerSource, /tasks\.page\.runtime\.taskBoard\.detail\.unavailable/);
  assert.match(managerSource, /tasks\.page\.runtime\.taskBoard\.detail\.loadFailed/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.description/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.payloadSummary/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.taskSummary/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.blocked/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.wait/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.state/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.statePayload/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.waitPayload/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.linkedTasksTitle/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.linkedTasksDescription/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.linkedTasksEmpty/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.session/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.agent/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.error/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.unavailable/);
  assert.match(managerSource, /tasks\.page\.runtime\.detail\.loadFailed/);
  assert.match(managerSource, /taskFlowDetail\.startedAt/);
  assert.match(managerSource, /taskFlowDetail\.finishedAt/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.sourceId/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.deliveryStatus/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.createdAt/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.startedAt/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.finishedAt/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.lastEventAt/);
  assert.match(managerSource, /item\.deliveryStatus/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.cleanupAfter/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.parentTask/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.result/);
  assert.match(managerSource, /tasks\.page\.runtime\.fields\.childSession/);
  assert.match(managerSource, /runtimeTaskDetail\.createdAt/);
  assert.match(managerSource, /runtimeTaskDetail\.startedAt/);
  assert.match(managerSource, /runtimeTaskDetail\.finishedAt/);
  assert.match(managerSource, /task\.createdAt/);
  assert.match(managerSource, /task\.startedAt/);
  assert.match(managerSource, /task\.finishedAt/);
  assert.match(managerSource, /formatTaskFlowLinkedTaskCleanupAfter/);
  assert.match(managerSource, /getTaskFlowLinkedTaskSourceId/);
  assert.match(managerSource, /getTaskFlowLinkedTaskParentTaskId/);
  assert.match(managerSource, /getTaskFlowLinkedTaskSummary/);
  assert.match(managerSource, /formatTaskFlowLinkedTaskResult/);
  assert.match(managerSource, /getTaskFlowLinkedTaskRequesterSession/);
  assert.match(managerSource, /task\.childSessionKey/);

  assert.equal(typeof enRuntime?.title, 'string');
  assert.equal(typeof enRuntime?.description, 'string');
  assert.equal(typeof enRuntime?.taskBoard, 'object');
  assert.equal(typeof enRuntime?.taskFlows, 'object');
  assert.equal(
    typeof ((enRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.description,
    'string',
  );
  assert.equal(
    typeof ((enRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.unavailable,
    'string',
  );
  assert.equal(
    typeof ((enRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.loadFailed,
    'string',
  );
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.currentStep, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.notifyPolicy, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.owner, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.requesterOrigin, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.cancelRequestedAt, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.cleanupAfter, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.createdAt, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.startedAt, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.deliveryStatus, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.finishedAt, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.lastEventAt, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.parentTask, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.result, 'string');
  assert.equal(typeof (enRuntime?.fields as Record<string, unknown>)?.sourceId, 'string');

  assert.equal(typeof zhRuntime?.title, 'string');
  assert.equal(typeof zhRuntime?.description, 'string');
  assert.equal(typeof zhRuntime?.taskBoard, 'object');
  assert.equal(typeof zhRuntime?.taskFlows, 'object');
  assert.equal(
    typeof ((zhRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.description,
    'string',
  );
  assert.equal(
    typeof ((zhRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.unavailable,
    'string',
  );
  assert.equal(
    typeof ((zhRuntime?.taskBoard as Record<string, unknown>)?.detail as Record<string, unknown>)?.loadFailed,
    'string',
  );
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.currentStep, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.notifyPolicy, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.owner, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.requesterOrigin, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.cancelRequestedAt, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.cleanupAfter, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.createdAt, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.startedAt, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.deliveryStatus, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.finishedAt, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.lastEventAt, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.parentTask, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.result, 'string');
  assert.equal(typeof (zhRuntime?.fields as Record<string, unknown>)?.sourceId, 'string');

  const enDetail = (enRuntime?.detail as Record<string, unknown>) || null;
  const zhDetail = (zhRuntime?.detail as Record<string, unknown>) || null;

  assert.equal(typeof enDetail?.description, 'string');
  assert.equal(typeof enDetail?.payloadSummary, 'string');
  assert.equal(typeof enDetail?.taskSummary, 'string');
  assert.equal(typeof enDetail?.blocked, 'string');
  assert.equal(typeof enDetail?.wait, 'string');
  assert.equal(typeof enDetail?.state, 'string');
  assert.equal(typeof enDetail?.statePayload, 'string');
  assert.equal(typeof enDetail?.waitPayload, 'string');
  assert.equal(typeof enDetail?.linkedTasksTitle, 'string');
  assert.equal(typeof enDetail?.linkedTasksDescription, 'string');
  assert.equal(typeof enDetail?.linkedTasksEmpty, 'string');
  assert.equal(typeof enDetail?.session, 'string');
  assert.equal(typeof enDetail?.agent, 'string');
  assert.equal(typeof enDetail?.error, 'string');
  assert.equal(typeof enDetail?.unavailable, 'string');
  assert.equal(typeof enDetail?.loadFailed, 'string');

  assert.equal(typeof zhDetail?.description, 'string');
  assert.equal(typeof zhDetail?.payloadSummary, 'string');
  assert.equal(typeof zhDetail?.taskSummary, 'string');
  assert.equal(typeof zhDetail?.blocked, 'string');
  assert.equal(typeof zhDetail?.wait, 'string');
  assert.equal(typeof zhDetail?.state, 'string');
  assert.equal(typeof zhDetail?.statePayload, 'string');
  assert.equal(typeof zhDetail?.waitPayload, 'string');
  assert.equal(typeof zhDetail?.linkedTasksTitle, 'string');
  assert.equal(typeof zhDetail?.linkedTasksDescription, 'string');
  assert.equal(typeof zhDetail?.linkedTasksEmpty, 'string');
  assert.equal(typeof zhDetail?.session, 'string');
  assert.equal(typeof zhDetail?.agent, 'string');
  assert.equal(typeof zhDetail?.error, 'string');
  assert.equal(typeof zhDetail?.unavailable, 'string');
  assert.equal(typeof zhDetail?.loadFailed, 'string');
});

runTest('sdkwork-claw-tasks shared manager uses compact label-control rows in the task editor', () => {
  const managerSource = read('packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx');

  assert.match(managerSource, /function renderCompactField\(/);
  assert.match(managerSource, /md:grid-cols-\[10rem,minmax\(0,1fr\)\]/);
  assert.match(
    managerSource,
    /renderCompactField\(\{\s*label:\s*t\('tasks\.page\.fields\.taskName'\)/,
  );
  assert.match(
    managerSource,
    /renderCompactField\(\{\s*label:\s*t\('tasks\.page\.fields\.timeoutSeconds'\)/,
  );
  assert.doesNotMatch(
    managerSource,
    /<Label className="mb-2 block">\{t\('tasks\.page\.fields\.taskName'\)\}<\/Label>/,
  );
});

runTest('sdkwork-claw-tasks ships readable zh task copy without mojibake placeholders', () => {
  const zh = readJson<{ tasks: { page: Record<string, unknown> } }>(
    'packages/sdkwork-claw-i18n/src/locales/zh.json',
  );
  const taskPage = zh.tasks.page as {
    title: string;
    subtitle: string;
    sections: { basicInfo: string; execution: string };
    fields: { prompt: string; executionContent: string };
    workspace: { scheduleTitle: string; deliveryTitle: string };
    toasts: { created: string };
    confirmDelete: string;
  };
  const serialized = JSON.stringify(taskPage);

  assert.equal(taskPage.title, '定时任务');
  assert.equal(taskPage.sections.basicInfo, '基本信息');
  assert.equal(taskPage.sections.execution, '执行设置');
  assert.equal(taskPage.fields.prompt, '提示词');
  assert.equal(taskPage.fields.executionContent, '执行内容');
  assert.equal(taskPage.workspace.scheduleTitle, '调度设置');
  assert.equal(taskPage.workspace.deliveryTitle, '结果交付');
  assert.equal(taskPage.toasts.created, '任务创建成功');
  assert.equal(taskPage.confirmDelete, '确认删除“{{name}}”吗？此操作不可恢复。');
  assert.doesNotMatch(serialized, /\uFFFD/);
  assert.doesNotMatch(serialized, /\?/);
  assert.doesNotMatch(serialized, /"Execution"/);
  assert.doesNotMatch(serialized, /"Prompt"/);
});
