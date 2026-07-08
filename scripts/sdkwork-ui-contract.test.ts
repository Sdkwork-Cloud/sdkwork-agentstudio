import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function walkFiles(dirPath: string, predicate: (filePath: string) => boolean): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath, predicate));
      continue;
    }

    if (predicate(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
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

runTest('sdkwork-clawstudio-ui is implemented locally instead of re-exporting claw-studio-shared-ui', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-clawstudio-ui/package.json');
  const indexSource = read('packages/sdkwork-clawstudio-ui/src/index.ts');
  const componentsIndexSource = read('packages/sdkwork-clawstudio-ui/src/components/index.ts');
  const taskRowListSource = read('packages/sdkwork-clawstudio-ui/src/components/TaskRowList.tsx');
  const taskCatalogSource = read('packages/sdkwork-clawstudio-ui/src/components/TaskCatalog.tsx');
  const taskCatalogMetaSource = read('packages/sdkwork-clawstudio-ui/src/components/taskCatalogMeta.ts');
  const taskExecutionHistoryDrawerSource = read(
    'packages/sdkwork-clawstudio-ui/src/components/TaskExecutionHistoryDrawer.tsx',
  );
  const channelCatalogSource = read('packages/sdkwork-clawstudio-ui/src/components/ChannelCatalog.tsx');
  const channelWorkspaceSource = read('packages/sdkwork-clawstudio-ui/src/components/ChannelWorkspace.tsx');
  const channelBindingGuidesSource = read('packages/sdkwork-clawstudio-ui/src/components/channelBindingGuides.ts');
  const channelRegionTabsSource = read('packages/sdkwork-clawstudio-ui/src/components/ChannelRegionTabs.tsx');
  const channelCatalogMetaSource = read('packages/sdkwork-clawstudio-ui/src/components/channelCatalogMeta.ts');
  const channelCatalogRegionContentSource = read(
    'packages/sdkwork-clawstudio-ui/src/components/channelCatalogRegionContent.ts',
  );
  const overlaySurfaceSource = read('packages/sdkwork-clawstudio-ui/src/components/OverlaySurface.tsx');

  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Modal.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Button.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Input.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Textarea.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Label.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Select.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Dialog.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Checkbox.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Switch.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/Slider.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/RepositoryCard.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/TaskRowList.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/TaskCatalog.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/TaskExecutionHistoryDrawer.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/ChannelWorkspace.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/channelBindingGuides.ts'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/ChannelRegionTabs.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/channelCatalogRegionContent.ts'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/components/taskCatalogMeta.ts'));
  assert.ok(exists('packages/sdkwork-clawstudio-ui/src/lib/utils.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/clawstudio-studio-shared-ui']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-shared-ui/);
  assert.match(indexSource, /export \* from '\.\/components'/);
  assert.match(indexSource, /OverlaySurface/);
  assert.match(indexSource, /overlayLayout/);
  assert.match(componentsIndexSource, /Button/);
  assert.match(componentsIndexSource, /Input/);
  assert.match(componentsIndexSource, /Textarea/);
  assert.match(componentsIndexSource, /Label/);
  assert.match(componentsIndexSource, /Select/);
  assert.match(componentsIndexSource, /Dialog/);
  assert.match(componentsIndexSource, /Checkbox/);
  assert.match(componentsIndexSource, /Switch/);
  assert.match(componentsIndexSource, /Slider/);
  assert.match(componentsIndexSource, /\.\/TaskCatalog/);
  assert.match(componentsIndexSource, /\.\/TaskExecutionHistoryDrawer/);
  assert.match(componentsIndexSource, /\.\/TaskRowList/);
  assert.match(componentsIndexSource, /\.\/ChannelWorkspace/);
  assert.match(componentsIndexSource, /\.\/channelBindingGuides/);
  assert.match(componentsIndexSource, /\.\/taskCatalogMeta/);
  assert.match(
    taskRowListSource,
    /interface TaskRowProps extends Omit<React\.HTMLAttributes<HTMLDivElement>, 'title'>/,
  );
  assert.match(taskRowListSource, /title: React\.ReactNode;/);
  assert.match(taskCatalogSource, /export interface TaskCatalogItem/);
  assert.match(taskCatalogSource, /export function TaskCatalog/);
  assert.match(taskCatalogMetaSource, /export function getTaskCatalogTone/);
  assert.match(taskExecutionHistoryDrawerSource, /export function TaskExecutionHistoryDrawer/);
  assert.match(channelCatalogSource, /onOpenOfficialLink\?:/);
  assert.match(channelCatalogSource, /onOpenOfficialLink\(channel, link\)/);
  assert.match(channelCatalogSource, /actionDownloadApp/);
  assert.match(channelCatalogSource, /showRegionTabs\?: boolean/);
  assert.match(channelCatalogSource, /ChannelRegionTabs/);
  assert.match(channelCatalogSource, /buildChannelCatalogRegionLabels\(t\)/);
  assert.match(channelCatalogSource, /buildChannelCatalogRegionDescriptions\(t\)/);
  assert.match(channelCatalogSource, /getChannelCatalogRegionEmptyText\(t, activeRegion\)/);
  assert.match(channelCatalogSource, /getChannelBindingGuide\(channel\.id\)/);
  assert.match(channelCatalogSource, /regionGroups\.all\.length/);
  assert.match(channelCatalogSource, /sortChannelCatalogItems/);
  assert.match(channelWorkspaceSource, /export interface ChannelWorkspaceItem/);
  assert.match(channelWorkspaceSource, /export function ChannelWorkspace/);
  assert.match(channelWorkspaceSource, /actionDownloadApp/);
  assert.match(channelWorkspaceSource, /ChannelRegionTabs/);
  assert.match(channelWorkspaceSource, /showRegionTabs=\{false\}/);
  assert.match(channelWorkspaceSource, /buildChannelCatalogRegionLabels\(t\)/);
  assert.doesNotMatch(channelWorkspaceSource, /buildChannelCatalogRegionDescriptions\(t\)/);
  assert.match(channelWorkspaceSource, /getChannelCatalogRegionEmptyText\(t, activeRegion\)/);
  assert.match(channelWorkspaceSource, /regionGroups\.all\.length/);
  assert.match(channelWorkspaceSource, /activeRegion !== 'all'/);
  assert.match(channelWorkspaceSource, /OverlaySurface/);
  assert.match(channelWorkspaceSource, /setupSteps/);
  assert.match(channelWorkspaceSource, /deleteConfigurationAction/);
  assert.match(channelWorkspaceSource, /getChannelBindingGuide/);
  assert.match(channelWorkspaceSource, /data-slot="channel-workspace-binding-command"/);
  assert.doesNotMatch(channelWorkspaceSource, /QRCode\.toDataURL/);
  assert.ok(!pkg.dependencies?.qrcode);
  assert.doesNotMatch(channelWorkspaceSource, /buildChannelQrContent/);
  assert.match(channelBindingGuidesSource, /openclaw-weixin/);
  assert.match(channelBindingGuidesSource, /qqbot/);
  assert.match(channelBindingGuidesSource, /openclaw channels add --channel qqbot/);
  assert.match(channelBindingGuidesSource, /@tencent-weixin\/openclaw-weixin-cli install/);
  assert.match(channelBindingGuidesSource, /openclaw channels login --channel feishu/);
  assert.match(channelBindingGuidesSource, /@dingtalk-real-ai\/dingtalk-connector install/);
  assert.doesNotMatch(channelBindingGuidesSource, /wecom:\s*\{/);
  assert.doesNotMatch(channelBindingGuidesSource, /@wecom\/wecom-openclaw-plugin install/);
  assert.doesNotMatch(channelBindingGuidesSource, /(?:^|\s)qq:\s*\{/);
  assert.doesNotMatch(channelBindingGuidesSource, /wechat:\s*\{/);
  assert.doesNotMatch(channelBindingGuidesSource, /dingtalk:\s*\{/);
  assert.match(channelCatalogRegionContentSource, /channels\.page\.catalog\.tabs\.domestic/);
  assert.match(channelCatalogRegionContentSource, /channels\.page\.catalog\.descriptions\.media/);
  assert.match(channelCatalogRegionContentSource, /channels\.page\.catalog\.empty\.all/);
  assert.match(channelCatalogRegionContentSource, /buildChannelCatalogRegionLabels/);
  assert.match(channelCatalogRegionContentSource, /buildChannelCatalogRegionDescriptions/);
  assert.match(channelCatalogRegionContentSource, /getChannelCatalogRegionEmptyText/);
  assert.match(channelRegionTabsSource, /data-slot="channel-region-tabs"/);
  assert.match(channelRegionTabsSource, /\['domestic', 'global', 'media', 'all'\]/);
  assert.match(channelCatalogMetaSource, /imessage:\s*\{/);
  assert.match(channelCatalogMetaSource, /irc:\s*\{/);
  assert.match(channelCatalogMetaSource, /matrix:\s*\{/);
  assert.match(channelCatalogMetaSource, /mattermost:\s*\{/);
  assert.match(channelCatalogMetaSource, /signal:\s*\{/);
  assert.match(channelCatalogMetaSource, /slack:\s*\{/);
  assert.match(channelCatalogMetaSource, /telegram:\s*\{/);
  assert.doesNotMatch(channelCatalogMetaSource, /sdkworkchat:\s*\{/);
  assert.doesNotMatch(channelCatalogMetaSource, /wehcat:\s*\{/);
  assert.doesNotMatch(channelCatalogMetaSource, /qq:\s*\{/);
  assert.match(channelCatalogMetaSource, /export type ChannelCatalogRegion = 'domestic' \| 'global' \| 'media' \| 'all'/);
  assert.match(channelCatalogMetaSource, /media: T\[];/);
  assert.match(channelCatalogMetaSource, /all: T\[];/);
  assert.match(channelCatalogMetaSource, /getChannelCatalogRegion/);
  assert.match(channelCatalogMetaSource, /getChannelCatalogRegions/);
  assert.match(channelCatalogMetaSource, /partitionChannelCatalogItemsByRegion/);
  assert.match(channelCatalogMetaSource, /resolveDefaultChannelCatalogRegion/);
  assert.match(channelCatalogMetaSource, /isChannelDownloadAppAction/);
  assert.match(channelCatalogMetaSource, /export function sortChannelCatalogItems/);
  assert.match(channelCatalogMetaSource, /imessage:\s*\{[\s\S]*regions:\s*\['global', 'media'\]/);
  assert.match(channelCatalogMetaSource, /telegram:\s*\{[\s\S]*regions:\s*\['global'\]/);
  assert.match(channelCatalogMetaSource, /groups\.all\.push\(item\)/);
  assert.match(channelCatalogMetaSource, /for \(const region of regions\)/);
  assert.match(channelCatalogMetaSource, /media: \[\]/);
  assert.match(channelCatalogMetaSource, /all: \[\]/);
  assert.match(channelCatalogMetaSource, /return 'all'/);
  assert.match(channelWorkspaceSource, /getChannelCatalogRegions/);
  assert.match(channelWorkspaceSource, /getChannelCatalogRegions\(selectedChannel\.id\)\.includes\(activeRegion\)/);
  assert.match(overlaySurfaceSource, /createPortal/);
  assert.match(overlaySurfaceSource, /document\.body/);
});

runTest('shared dialog and overlay primitives expose stable surface slots for light theme depth', () => {
  const dialogSource = read('packages/sdkwork-clawstudio-ui/src/components/Dialog.tsx');
  const overlaySurfaceSource = read('packages/sdkwork-clawstudio-ui/src/components/OverlaySurface.tsx');

  assert.match(dialogSource, /data-slot="dialog-overlay"/);
  assert.match(dialogSource, /data-slot="dialog-content"/);
  assert.match(overlaySurfaceSource, /data-slot="overlay-backdrop"/);
  assert.match(overlaySurfaceSource, /data-slot=\{`overlay-surface-\$\{variant\}`\}/);
});

runTest('feature packages use shared shadcn-style form primitives instead of native controls', () => {
  const packagesRoot = path.join(root, 'packages');
  const architectureAllowList = new Set([
    // @sdkwork/clawstudio-core is not allowed to depend on @sdkwork/clawstudio-ui by repo architecture rules.
    'packages/sdkwork-clawstudio-core/src/components/CommandPalette.tsx',
  ]);
  const sourceFiles = walkFiles(
    packagesRoot,
    (filePath) =>
      filePath.endsWith('.tsx') &&
      !filePath.includes(`${path.sep}sdkwork-clawstudio-ui${path.sep}src${path.sep}components${path.sep}`),
  );

  const nativeControlPattern = /<(input|select|textarea)\b[\s\S]*?>/g;
  const allowedInputTypePattern = /type=(['"])(file|hidden)\1/;
  const violations: string[] = [];

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');

    if (architectureAllowList.has(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const matches = source.matchAll(nativeControlPattern);

    for (const match of matches) {
      const [tag] = match;
      const tagName = match[1];

      if (tagName === 'input' && allowedInputTypePattern.test(tag)) {
        continue;
      }

      const startIndex = match.index ?? 0;
      const lineNumber = source.slice(0, startIndex).split('\n').length;
      violations.push(`${relativePath}:${lineNumber} uses native <${tagName}>`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Native form controls remain outside @sdkwork/clawstudio-ui:\n${violations.join('\n')}`,
  );
});

runTest('shared form primitives keep interactive layers and focus states compatible with overlay drawers', () => {
  const overlaySurfaceSource = read('packages/sdkwork-clawstudio-ui/src/components/OverlaySurface.tsx');
  const selectSource = read('packages/sdkwork-clawstudio-ui/src/components/Select.tsx');
  const inputSource = read('packages/sdkwork-clawstudio-ui/src/components/Input.tsx');
  const textareaSource = read('packages/sdkwork-clawstudio-ui/src/components/Textarea.tsx');
  const switchSource = read('packages/sdkwork-clawstudio-ui/src/components/Switch.tsx');

  assert.match(overlaySurfaceSource, /z-\[120\]/);
  assert.match(
    selectSource,
    /z-\[(1[3-9]\d|[2-9]\d{2,})\]/,
    'select content should render above overlay drawers so option clicks remain reachable',
  );
  assert.match(selectSource, /focus:ring-2/);
  assert.match(selectSource, /disabled:cursor-not-allowed/);
  assert.match(inputSource, /focus-visible:ring-2/);
  assert.match(inputSource, /disabled:cursor-not-allowed/);
  assert.match(textareaSource, /focus-visible:ring-2/);
  assert.match(textareaSource, /disabled:cursor-not-allowed/);
  assert.match(switchSource, /focus-visible:ring-2/);
  assert.match(switchSource, /disabled:cursor-not-allowed/);
});

runTest('overlay surfaces close from any external click while preserving drawer and modal interactions inside the surface', () => {
  const overlaySurfaceSource = read('packages/sdkwork-clawstudio-ui/src/components/OverlaySurface.tsx');

  assert.match(
    overlaySurfaceSource,
    /className=\{cn\(\s*'absolute inset-0 bg-zinc-950\/45 backdrop-blur-sm'/,
  );
  assert.match(
    overlaySurfaceSource,
    /className=\{cn\(\s*'relative flex h-full'/,
  );
  assert.match(
    overlaySurfaceSource,
    /onClick=\{closeOnBackdrop \? onClose : undefined\}/,
  );
  assert.match(
    overlaySurfaceSource,
    /onClick=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
  assert.doesNotMatch(
    overlaySurfaceSource,
    /className="absolute inset-x-0 bottom-0 top-12 bg-zinc-950\/45 backdrop-blur-sm"/,
  );
});
