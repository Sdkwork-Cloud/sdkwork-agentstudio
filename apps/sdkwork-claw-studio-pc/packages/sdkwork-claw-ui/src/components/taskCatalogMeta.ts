import type { TaskRowBadgeTone, TaskRowTone } from './TaskRowList';

export function getTaskCatalogTone(
  status: string,
  latestExecutionStatus?: string | null,
): TaskRowTone {
  if (status === 'failed' || latestExecutionStatus === 'failed') {
    return 'danger';
  }
  if (status === 'paused') {
    return 'paused';
  }
  if (status === 'active') {
    return 'healthy';
  }
  return 'default';
}

export function getTaskStatusBadgeTone(status: string): TaskRowBadgeTone {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'paused') {
    return 'warning';
  }
  if (status === 'failed') {
    return 'danger';
  }
  return 'neutral';
}

export function getTaskExecutionBadgeTone(executionContent: string): TaskRowBadgeTone {
  return executionContent === 'sendPromptMessage' ? 'neutral' : 'info';
}

export function getTaskToggleStatusTarget(status: string): 'active' | 'paused' | null {
  if (status === 'active') {
    return 'paused';
  }
  if (status === 'paused') {
    return 'active';
  }
  return null;
}

export function getTaskHistoryBadgeTone(status: string): TaskRowBadgeTone {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'failed') {
    return 'danger';
  }
  return 'warning';
}

export function getTaskPreview(text?: string, maxLength = 180) {
  if (!text) {
    return '';
  }

  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}
