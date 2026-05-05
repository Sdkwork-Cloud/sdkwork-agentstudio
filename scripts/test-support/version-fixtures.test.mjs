import assert from 'node:assert/strict';

import { derivePreviousNumericVersion, shiftNumericVersion } from './version-fixtures.mjs';

assert.equal(
  derivePreviousNumericVersion('2026.5.3-1'),
  '2026.5.2',
  'derivePreviousNumericVersion must derive stale fixtures from stable hotfix suffix versions',
);

assert.equal(
  shiftNumericVersion('2026.5.3-1', -1),
  '2026.5.2',
  'shiftNumericVersion must derive previous fixtures from stable hotfix suffix versions',
);

assert.equal(
  shiftNumericVersion('2026.5.3-1', 1),
  '2026.5.4',
  'shiftNumericVersion must derive future fixtures from stable hotfix suffix versions',
);

assert.equal(
  derivePreviousNumericVersion('2026.5.4-beta.1'),
  '2026.5.3',
  'derivePreviousNumericVersion must derive stale fixtures from beta prerelease versions',
);

assert.equal(
  shiftNumericVersion('2026.5.4-beta.1', -1),
  '2026.5.3',
  'shiftNumericVersion must derive previous fixtures from beta prerelease versions',
);

assert.equal(
  shiftNumericVersion('2026.5.4-beta.1', 1),
  '2026.5.5',
  'shiftNumericVersion must derive future fixtures from beta prerelease versions',
);
