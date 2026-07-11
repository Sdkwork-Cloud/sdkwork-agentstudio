import type {
  TaskFormErrorKey,
  TaskFormErrors,
  TaskFormValues,
  TaskScheduleMode,
} from './taskSchedule.ts';

export type TaskCreateSectionId = 'basicInfo' | 'execution';
export type TaskCreateSectionStatus = 'pending' | 'attention' | 'complete';
export type TaskCreateFieldId =
  | TaskFormErrorKey
  | 'sessionMode'
  | 'customSessionId'
  | 'wakeUpMode'
  | 'executionContent'
  | 'deleteAfterRun'
  | 'agentId'
  | 'model'
  | 'thinking'
  | 'lightContext'
  | 'toolAllowlist'
  | 'deliveryMode'
  | 'deliveryBestEffort'
  | 'deliveryChannel'
  | 'recipient';

export interface TaskCreateSectionState {
  id: TaskCreateSectionId;
  status: TaskCreateSectionStatus;
  completedRequired: number;
  totalRequired: number;
}

export interface TaskCreateReadinessState {
  ready: boolean;
  blockingFields: TaskFormErrorKey[];
}

export interface TaskCreateBasicInfoState {
  mode: TaskScheduleMode;
  showScheduleAdvanced: boolean;
  scheduleFieldIds: TaskCreateFieldId[];
  advancedFieldIds: TaskCreateFieldId[];
}

export interface TaskCreateExecutionState {
  runtimeFieldIds: TaskCreateFieldId[];
  deliveryFieldIds: TaskCreateFieldId[];
}

export interface TaskCreateWorkspaceState {
  sections: TaskCreateSectionState[];
  readiness: TaskCreateReadinessState;
  basicInfo: TaskCreateBasicInfoState;
  execution: TaskCreateExecutionState;
}

const scheduleFieldIdsByMode: Record<TaskScheduleMode, TaskCreateFieldId[]> = {
  interval: ['intervalValue'],
  datetime: ['scheduledDate', 'scheduledTime'],
  cron: [],
};

const advancedScheduleFieldIdsByMode: Record<TaskScheduleMode, TaskCreateFieldId[]> = {
  interval: [],
  datetime: [],
  cron: ['cronExpression', 'staggerMs'],
};

const runtimeFieldIds: TaskCreateFieldId[] = [
  'sessionMode',
  'customSessionId',
  'wakeUpMode',
  'executionContent',
  'timeoutSeconds',
  'deleteAfterRun',
  'agentId',
  'model',
  'thinking',
  'lightContext',
  'toolAllowlist',
];

const deliveryFieldIds: TaskCreateFieldId[] = [
  'deliveryMode',
  'deliveryBestEffort',
  'deliveryChannel',
  'recipient',
];

function getSectionStatus(
  completedRequired: number,
  totalRequired: number,
  hasBlockingErrors = false,
): TaskCreateSectionStatus {
  if (hasBlockingErrors) {
    return completedRequired <= 0 ? 'pending' : 'attention';
  }

  if (completedRequired >= totalRequired) {
    return 'complete';
  }

  if (completedRequired <= 0) {
    return 'pending';
  }

  return 'attention';
}

function hasName(values: TaskFormValues) {
  return values.name.trim().length > 0;
}

function hasPrompt(values: TaskFormValues) {
  return values.prompt.trim().length > 0;
}

function isScheduleConfigured(values: TaskFormValues, errors: TaskFormErrors) {
  const scheduleFieldIds = [
    ...scheduleFieldIdsByMode[values.scheduleMode],
    ...advancedScheduleFieldIdsByMode[values.scheduleMode],
  ];

  return scheduleFieldIds.every((fieldId) => !errors[fieldId as TaskFormErrorKey]);
}

function hasExecutionDefaults(values: TaskFormValues) {
  return Boolean(values.sessionMode && values.wakeUpMode && values.executionContent);
}

function hasDeliveryDefaults(values: TaskFormValues) {
  return Boolean(values.deliveryMode);
}

const basicInfoErrorKeys: TaskFormErrorKey[] = [
  'name',
  'prompt',
  'intervalValue',
  'scheduledDate',
  'scheduledTime',
  'cronExpression',
  'staggerMs',
];

const executionErrorKeys: TaskFormErrorKey[] = ['customSessionId', 'timeoutSeconds', 'recipient'];

export function buildTaskCreateWorkspaceState(
  values: TaskFormValues,
  errors: TaskFormErrors,
): TaskCreateWorkspaceState {
  const basicInfoCompletedRequired =
    Number(hasName(values)) + Number(hasPrompt(values)) + Number(isScheduleConfigured(values, errors));
  const executionCompletedRequired =
    Number(Boolean(values.sessionMode && values.wakeUpMode)) +
    Number(hasExecutionDefaults(values)) +
    Number(hasDeliveryDefaults(values));
  const blockingFields = Object.keys(errors) as TaskFormErrorKey[];
  const basicInfoHasBlockingErrors = basicInfoErrorKeys.some((field) => blockingFields.includes(field));
  const executionHasBlockingErrors = executionErrorKeys.some((field) => blockingFields.includes(field));

  return {
    sections: [
      {
        id: 'basicInfo',
        status: getSectionStatus(basicInfoCompletedRequired, 3, basicInfoHasBlockingErrors),
        completedRequired: basicInfoCompletedRequired,
        totalRequired: 3,
      },
      {
        id: 'execution',
        status: getSectionStatus(executionCompletedRequired, 3, executionHasBlockingErrors),
        completedRequired: executionCompletedRequired,
        totalRequired: 3,
      },
    ],
    readiness: {
      ready: blockingFields.length === 0,
      blockingFields,
    },
    basicInfo: {
      mode: values.scheduleMode,
      showScheduleAdvanced: values.scheduleMode === 'cron',
      scheduleFieldIds: scheduleFieldIdsByMode[values.scheduleMode],
      advancedFieldIds: advancedScheduleFieldIdsByMode[values.scheduleMode],
    },
    execution: {
      runtimeFieldIds,
      deliveryFieldIds,
    },
  };
}
