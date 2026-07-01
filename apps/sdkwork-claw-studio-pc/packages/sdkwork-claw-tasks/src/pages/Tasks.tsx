import { useInstanceStore } from '@sdkwork/claw-core';
import { CronTasksManager } from '@sdkwork/claw-commons';

export function Tasks() {
  const { activeInstanceId } = useInstanceStore();

  return <CronTasksManager instanceId={activeInstanceId ?? undefined} />;
}
