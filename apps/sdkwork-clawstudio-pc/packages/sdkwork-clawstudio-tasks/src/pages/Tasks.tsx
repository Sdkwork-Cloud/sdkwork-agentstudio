import { useInstanceStore } from '@sdkwork/clawstudio-core';
import { CronTasksManager } from '@sdkwork/clawstudio-commons';

export function Tasks() {
  const { activeInstanceId } = useInstanceStore();

  return <CronTasksManager instanceId={activeInstanceId ?? undefined} />;
}
