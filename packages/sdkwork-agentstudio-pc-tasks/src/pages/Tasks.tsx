import { useInstanceStore } from '@sdkwork/agentstudio-pc-core';
import { CronTasksManager } from '@sdkwork/agentstudio-pc-commons';

export function Tasks() {
  const { activeInstanceId } = useInstanceStore();

  return <CronTasksManager instanceId={activeInstanceId ?? undefined} />;
}
