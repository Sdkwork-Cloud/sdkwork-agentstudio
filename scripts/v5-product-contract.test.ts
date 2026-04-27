import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const v5RouteSurfaceBaselinePath = path.join(
  root,
  'scripts',
  'fixtures',
  'claw-studio-v5-route-surface.json',
);

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
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

runTest('V5 contract includes auth and extended surface routes', () => {
  const baseline = JSON.parse(fs.readFileSync(v5RouteSurfaceBaselinePath, 'utf8')) as {
    source: string;
    routes: string[];
  };

  assert.equal(baseline.source, 'upgrade/claw-studio-v5/src/App.tsx');
  assert.equal(Array.isArray(baseline.routes), true);
  assert.ok(baseline.routes.includes('/auth'));
  assert.ok(baseline.routes.includes('/login'));
  assert.ok(baseline.routes.includes('/register'));
  assert.ok(baseline.routes.includes('/forgot-password'));
  assert.ok(baseline.routes.includes('/claw-upload'));
  assert.equal(baseline.routes.includes('/api-router'), false);
});
