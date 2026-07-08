import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distAssetsDir = path.join(
  root,
  'packages',
  'sdkwork-clawstudio-web',
  'dist',
  'assets',
);

if (!fs.existsSync(distAssetsDir)) {
  console.error('Missing build output: packages/sdkwork-clawstudio-web/dist/assets');
  process.exit(1);
}

const cssFile = fs
  .readdirSync(distAssetsDir)
  .find((name) => /^index-.*\.css$/.test(name));

if (!cssFile) {
  console.error('Missing built CSS asset in packages/sdkwork-clawstudio-web/dist/assets');
  process.exit(1);
}

const css = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');

const requiredPatterns = [
  {
    label: 'feature layout class .sticky',
    pattern: '.sticky{',
  },
  {
    label: 'feature layout class .min-h-full',
    pattern: '.min-h-full{',
  },
  {
    label: 'feature layout class .grid-cols-3',
    pattern: '.grid-cols-3{',
  },
  {
    label: 'shared-ui custom radius class .rounded-[2rem]',
    pattern: '.rounded-\\[2rem\\]{',
  },
  {
    label: 'shared-ui custom height class .max-h-[90vh]',
    pattern: '.max-h-\\[90vh\\]{',
  },
  {
    label: 'shared-ui visual effect class .blur-3xl',
    pattern: '.blur-3xl{',
  },
];

const missing = requiredPatterns.filter(({ pattern }) => !css.includes(pattern));

if (missing.length > 0) {
  console.error('Tailwind build is missing workspace feature/shared-ui classes:\n');
  for (const entry of missing) {
    console.error(`- ${entry.label}`);
  }
  process.exit(1);
}

console.log(`Tailwind workspace style coverage check passed: ${cssFile}`);
