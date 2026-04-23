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

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-channels is implemented locally with V5 instance-aware channel wiring', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-channels/package.json');
  const indexSource = read('packages/sdkwork-claw-channels/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-channels/src/services/index.ts');
  const serviceSource = read('packages/sdkwork-claw-channels/src/services/channelService.ts');
  const pageSource = read('packages/sdkwork-claw-channels/src/pages/channels/Channels.tsx');
  const resolverSource = read('packages/sdkwork-claw-channels/src/pages/channels/channelInstanceResolver.ts');
  const zhSidebar = readJson<{ channels: string }>('packages/sdkwork-claw-i18n/src/locales/zh/sidebar.json');
  const zhChannels = readJson<{
    page: {
      feedback: {
        loadFailed: string;
        loadFailedServiceUnavailable: string;
        saveFailed: string;
        deleteFailed: string;
        toggleFailed: string;
      };
      title: string;
      catalog: {
        tabs: Record<'domestic' | 'global' | 'media' | 'all', string>;
      };
    };
  }>('packages/sdkwork-claw-i18n/src/locales/zh/channels.json');
  const enChannels = readJson<{
    page: {
      feedback: {
        loadFailed: string;
        loadFailedServiceUnavailable: string;
        saveFailed: string;
        deleteFailed: string;
        toggleFailed: string;
      };
      catalog: {
        tabs: Record<'domestic' | 'global' | 'media' | 'all', string>;
      };
    };
  }>('packages/sdkwork-claw-i18n/src/locales/en/channels.json');

  assert.ok(exists('packages/sdkwork-claw-channels/src/Channels.tsx'));
  assert.ok(exists('packages/sdkwork-claw-channels/src/services/channelService.ts'));
  assert.ok(exists('packages/sdkwork-claw-channels/src/pages/channels/channelInstanceResolver.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-channels']);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-instances']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-channels/);
  assert.doesNotMatch(indexSource, /\.test['"]/);
  assert.doesNotMatch(servicesIndexSource, /\.test['"]/);

  assert.match(serviceSource, /import\s+\{\s*getPlatformBridge\s*\}\s+from\s+'@sdkwork\/claw-infrastructure'/);
  assert.match(serviceSource, /openClawConfigService/);
  assert.match(serviceSource, /StudioInstanceDetailRecord/);
  assert.match(serviceSource, /resolveInstanceConfigPath/);
  assert.match(serviceSource, /return getPlatformBridge\(\)\.studio/);
  assert.match(serviceSource, /getInstanceDetail\(instanceId: string\)/);
  assert.match(serviceSource, /getChannels\(instanceId: string\): Promise<Channel\[]>/);
  assert.match(serviceSource, /isMissingConfigFileError/);
  assert.match(serviceSource, /detail\?\.workbench && isMissingConfigFileError\(error\)/);
  assert.match(serviceSource, /detail\?\.workbench/);
  assert.match(serviceSource, /mapWorkbenchChannels\(detail\)/);
  assert.match(serviceSource, /updateChannelStatus\(instanceId: string, channelId: string, enabled: boolean\)/);
  assert.match(serviceSource, /setInstanceChannelEnabled/);
  assert.match(serviceSource, /openClawConfigService\.setChannelEnabled/);
  assert.match(serviceSource, /saveChannelConfig\(instanceId: string, channelId: string, configData: Record<string, string>\)/);
  assert.match(serviceSource, /saveInstanceChannelConfig/);
  assert.match(serviceSource, /openClawConfigService\.saveChannelConfiguration/);
  assert.match(serviceSource, /deleteChannelConfig\(instanceId: string, channelId: string\)/);
  assert.match(serviceSource, /deleteInstanceChannelConfig/);
  assert.doesNotMatch(serviceSource, /from 'react'/);
  assert.doesNotMatch(serviceSource, /from 'lucide-react'/);
  assert.doesNotMatch(serviceSource, /React\.ReactNode/);
  assert.doesNotMatch(serviceSource, /React\.createElement/);
  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.doesNotMatch(serviceSource, /fetch\('/);

  assert.match(resolverSource, /resolveChannelsPageInstanceId/);
  assert.match(resolverSource, /activeInstanceId/);
  assert.match(resolverSource, /listInstances/);
  assert.match(resolverSource, /setActiveInstanceId/);

  assert.match(pageSource, /useInstanceStore/);
  assert.match(pageSource, /instanceDirectoryService/);
  assert.match(pageSource, /const \{ activeInstanceId, setActiveInstanceId \} = useInstanceStore\(\)/);
  assert.match(pageSource, /resolveChannelsPageInstanceId/);
  assert.match(pageSource, /const effectiveInstanceId = activeInstanceId \|\| resolvedInstanceId/);
  assert.match(pageSource, /const \[errorMessage, setErrorMessage\] = useState<string \| null>\(null\)/);
  assert.match(pageSource, /const \[resolvedInstanceId, setResolvedInstanceId\] = useState<string \| null>/);
  assert.match(pageSource, /channelService\.getChannels\(effectiveInstanceId\)/);
  assert.match(pageSource, /channelService\.updateChannelStatus\(\s*effectiveInstanceId,\s*channel\.id,\s*nextEnabled,\s*\)/);
  assert.match(pageSource, /channelService\.saveChannelConfig\(\s*effectiveInstanceId,\s*selectedChannel\.id,\s*formData,\s*\)/);
  assert.match(pageSource, /channelService\.deleteChannelConfig\(\s*effectiveInstanceId,\s*selectedChannel\.id,\s*\)/);
  assert.match(pageSource, /ChannelWorkspace/);
  assert.match(pageSource, /getChannelOfficialLink/);
  assert.match(pageSource, /openExternalUrl/);
  assert.match(pageSource, /channels\.page\.feedback\.loadFailed/);
  assert.match(pageSource, /channels\.page\.feedback\.loadFailedServiceUnavailable/);
  assert.match(pageSource, /actionDownloadApp/);
  assert.match(pageSource, /error=\{errorMessage\}/);
  assert.match(pageSource, /isSaving=\{isSaving\}/);
  assert.match(pageSource, /onOpenOfficialLink=\{\(_channel, link\) => void openOfficialLink\(link\.href\)\}/);
  assert.doesNotMatch(pageSource, /href=\{selectedChannelOfficialLink\.href\}/);
  assert.equal(zhSidebar.channels, '\u804a\u5929\u901a\u9053');
  assert.equal(zhChannels.page.title, '\u804a\u5929\u901a\u9053');
  assert.equal(typeof zhChannels.page.feedback.loadFailed, 'string');
  assert.equal(typeof zhChannels.page.feedback.loadFailedServiceUnavailable, 'string');
  assert.equal(typeof zhChannels.page.feedback.saveFailed, 'string');
  assert.equal(typeof zhChannels.page.feedback.deleteFailed, 'string');
  assert.equal(typeof zhChannels.page.feedback.toggleFailed, 'string');
  assert.equal(zhChannels.page.catalog.tabs.domestic, '\u56fd\u5185');
  assert.equal(zhChannels.page.catalog.tabs.global, '\u56fd\u9645');
  assert.equal(zhChannels.page.catalog.tabs.all, '\u5168\u90e8');
  assert.equal(typeof zhChannels.page.catalog.tabs.media, 'string');
  assert.equal(typeof enChannels.page.feedback.loadFailed, 'string');
  assert.equal(typeof enChannels.page.feedback.loadFailedServiceUnavailable, 'string');
  assert.equal(typeof enChannels.page.feedback.saveFailed, 'string');
  assert.equal(typeof enChannels.page.feedback.deleteFailed, 'string');
  assert.equal(typeof enChannels.page.feedback.toggleFailed, 'string');
  assert.equal(enChannels.page.catalog.tabs.media, 'Media Accounts');
  assert.equal(enChannels.page.catalog.tabs.all, 'All');
});
