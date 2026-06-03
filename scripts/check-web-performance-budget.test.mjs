import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  WEB_PERFORMANCE_BUDGETS,
  assertWebPerformanceBudget,
} from './check-web-performance-budget.mjs';

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createTempAssetsDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-web-budget-'));
  const assetsDir = path.join(tempDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  return { tempDir, assetsDir };
}

function writeSizedAsset(assetsDir, name, size) {
  fs.writeFileSync(path.join(assetsDir, name), 'x'.repeat(size));
}

function writeBaselineBudgetAssets(assetsDir, overrides = {}) {
  const assets = {
    'index-test.js': 310 * 1024,
    'index-test.css': 300 * 1024,
    'community-editor-test.js': 360 * 1024,
    'useInstanceStore-test.js': 245 * 1024,
    'NewPost-test.js': 2_990,
    'InstanceDetail-test.js': 184_778,
    'InstanceConfigWorkbenchPanel-test.js': 63_329,
    'InstanceDetailFilesSection-test.js': 2_385,
    'markdown-runtime-test.js': 219_700,
    'claw-i18n-runtime-test.js': 65_536,
    'claw-i18n-en-test.js': 243_322,
    'claw-i18n-zh-test.js': 232_253,
    ...overrides,
  };

  Object.entries(assets).forEach(([name, size]) => {
    if (size !== null) {
      writeSizedAsset(assetsDir, name, size);
    }
  });
}

runTest('web performance budget accepts the current split chunk shape under budget', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir);

    assert.doesNotThrow(() => assertWebPerformanceBudget(assetsDir));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects untracked oversized app chunks', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir);
    writeSizedAsset(assetsDir, 'feature-regression-test.js', 401 * 1024);

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /feature-regression-test\.js/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects a missing heavy panel split chunk', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir, {
      'InstanceDetailFilesSection-test.js': null,
    });

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /InstanceDetailFilesSection/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects chunks that regress past the frozen limit', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir, {
      'InstanceDetail-test.js': WEB_PERFORMANCE_BUDGETS.instanceDetail.maxBytes + 1,
    });

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /InstanceDetail/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects i18n runtime regressions that collapse back into the shared chunk', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir, {
      'claw-i18n-runtime-test.js': WEB_PERFORMANCE_BUDGETS.clawI18nRuntime.maxBytes + 1,
    });

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /claw-i18n runtime chunk/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects NewPost route shell regressions that pull the heavy editor back into the route chunk', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir, {
      'NewPost-test.js': WEB_PERFORMANCE_BUDGETS.newPostRouteShell.maxBytes + 1,
    });

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /NewPost route shell chunk/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('web performance budget rejects markdown runtime regressions after the raw-html security hardening', () => {
  const { tempDir, assetsDir } = createTempAssetsDir();
  try {
    writeBaselineBudgetAssets(assetsDir, {
      'markdown-runtime-test.js': WEB_PERFORMANCE_BUDGETS.markdownRuntime.maxBytes + 1,
    });

    assert.throws(() => assertWebPerformanceBudget(assetsDir), /markdown-runtime chunk/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
