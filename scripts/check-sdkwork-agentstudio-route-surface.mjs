import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellRoutesPath = path.join(
  root,
  'packages',
  'sdkwork-agentstudio-pc-shell',
  'src',
  'application',
  'router',
  'AppRoutes.tsx',
);
const v5RouteSurfaceBaselinePath = path.join(
  root,
  'scripts',
  'fixtures',
  'agent-studio-v5-route-surface.json',
);

function read(relPath) {
  if (!fs.existsSync(relPath)) {
    console.error(`Missing route source: ${path.relative(root, relPath)}`);
    process.exit(1);
  }

  return fs.readFileSync(relPath, 'utf8');
}

function extractRoutes(source) {
  const routeMatches = source.matchAll(/path="([^"]+)"/g);
  return [...new Set([...routeMatches].map((match) => match[1]).filter(Boolean))].sort();
}

function readRouteSurfaceBaseline(relPath) {
  if (!fs.existsSync(relPath)) {
    console.error(`Missing route surface baseline: ${path.relative(root, relPath)}`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(relPath, 'utf8'));
  if (!Array.isArray(parsed?.routes)) {
    console.error(`Invalid route surface baseline: ${path.relative(root, relPath)}`);
    process.exit(1);
  }

  return [...new Set(parsed.routes.filter((route) => typeof route === 'string' && route.length > 0))].sort();
}

const shellRoutes = extractRoutes(read(shellRoutesPath));
const v5Routes = readRouteSurfaceBaseline(v5RouteSurfaceBaselinePath);
const approvedTemplateExtensions = new Set([
  '/dashboard',
  '/usage',
  '/login/oauth/callback/:provider',
  '/agents',
  '/kernel',
  '/nodes',
]);
const missingRoutes = v5Routes.filter((route) => !shellRoutes.includes(route));
const extraRoutes = shellRoutes.filter(
  (route) => !v5Routes.includes(route) && !approvedTemplateExtensions.has(route),
);

if (missingRoutes.length > 0 || extraRoutes.length > 0) {
  console.error('SDKWork Claw route surface check failed:');
  for (const route of missingRoutes) {
    console.error(`- Missing V5 route ${route} in ${path.relative(root, shellRoutesPath)}`);
  }
  for (const route of extraRoutes) {
    console.error(`- Extra non-V5 route ${route} in ${path.relative(root, shellRoutesPath)}`);
  }
  process.exit(1);
}

console.log(
  `SDKWork Claw route surface check passed. Approved template extensions: ${[
    ...approvedTemplateExtensions,
  ].join(', ')}`,
);
