import { useEffect, useState } from 'react';

export function useActionCooldown(durationSeconds = 60) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return undefined;
    }

    const timer = globalThis.setTimeout(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1_000);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [remainingSeconds]);

  return {
    remainingSeconds,
    isCoolingDown: remainingSeconds > 0,
    startCooldown: () => setRemainingSeconds(durationSeconds),
    resetCooldown: () => setRemainingSeconds(0),
  };
}
