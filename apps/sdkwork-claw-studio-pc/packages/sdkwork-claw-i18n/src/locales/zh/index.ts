import englishLocale from '../en/index.ts';
import common from './common.json' with { type: 'json' };
import sidebar from './sidebar.json' with { type: 'json' };
import auth from './auth.json' with { type: 'json' };
import settings from './settings.json' with { type: 'json' };
import commandPalette from './commandPalette.json' with { type: 'json' };
import taskManager from './taskManager.json' with { type: 'json' };
import routes from './routes.json' with { type: 'json' };
import dashboard from './dashboard.json' with { type: 'json' };
import chat from './chat.json' with { type: 'json' };
import community from './community.json' with { type: 'json' };
import clawUpload from './clawUpload.json' with { type: 'json' };
import account from './account.json' with { type: 'json' };
import clawCenter from './clawCenter.json' with { type: 'json' };
import clawDetail from './clawDetail.json' with { type: 'json' };
import products from './products.json' with { type: 'json' };
import categories from './categories.json' with { type: 'json' };
import channels from './channels.json' with { type: 'json' };
import installModal from './installModal.json' with { type: 'json' };
import tasks from './tasks.json' with { type: 'json' };
import instances from './instances.json' with { type: 'json' };
import extensions from './extensions.json' with { type: 'json' };
import repositoryCard from './repositoryCard.json' with { type: 'json' };
import devices from './devices.json' with { type: 'json' };
import docs from './docs.json' with { type: 'json' };
import install from './install.json' with { type: 'json' };
import agentMarket from './agentMarket.json' with { type: 'json' };
import apiLogs from './apiLogs.json' with { type: 'json' };
import providerCenter from './providerCenter.json' with { type: 'json' };
import { mergeLocaleResource } from '../mergeLocale.ts';

const locale = mergeLocaleResource(englishLocale, {
  common,
  sidebar,
  auth,
  settings,
  commandPalette,
  taskManager,
  routes,
  dashboard,
  chat,
  community,
  clawUpload,
  account,
  clawCenter,
  clawDetail,
  products,
  categories,
  channels,
  installModal,
  tasks,
  instances,
  extensions,
  repositoryCard,
  devices,
  docs,
  install,
  agentMarket,
  apiLogs,
  providerCenter,
});

locale.settings.general.languageFallbackTo =
  '\u5f53\u524d\u5728 Claw Studio \u4e2d\u56de\u9000\u5230 {{language}} \u7ffb\u8bd1\u3002';
locale.sidebar.usage = '\u7f51\u5173\u7528\u91cf';
locale.commandPalette.commands.usage = {
  title: '\u6253\u5f00\u7f51\u5173\u7528\u91cf',
  subtitle:
    '\u67e5\u770b OpenClaw \u7f51\u5173\u4f1a\u8bdd\u7528\u91cf\u3001\u6210\u672c\u4e0e\u8be6\u7ec6\u65e5\u5fd7',
};
locale.dashboard.usage = {
  page: {
    eyebrow: '\u8fd0\u8425\u5206\u6790',
    title: '\u7f51\u5173\u7528\u91cf',
    description:
      '\u5728\u7edf\u4e00\u5de5\u4f5c\u53f0\u4e2d\u67e5\u770b OpenClaw \u7f51\u5173\u4f1a\u8bdd\u7528\u91cf\u3001\u6210\u672c\u3001\u517c\u5bb9\u56de\u9000\u72b6\u6001\u4e0e\u5355\u4f1a\u8bdd\u660e\u7ec6\u3002',
    loading: '\u6b63\u5728\u52a0\u8f7d\u7528\u91cf\u5de5\u4f5c\u53f0',
    emptyTitle: '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684 OpenClaw \u7f51\u5173',
    emptyDescription:
      '\u8bf7\u5148\u6dfb\u52a0\u6216\u542f\u52a8\u57fa\u4e8e OpenClaw \u7684\u5b9e\u4f8b\uff0c\u518d\u67e5\u770b\u7528\u91cf\u548c\u6210\u672c\u8bc1\u636e\u3002',
    noSnapshot: '\u7528\u91cf\u5feb\u7167\u4e0d\u53ef\u7528',
  },
  actions: {
    openInstances: '\u6253\u5f00\u5b9e\u4f8b',
  },
  filters: {
    instance: '\u5b9e\u4f8b',
    startDate: '\u5f00\u59cb\u65e5\u671f',
    endDate: '\u7ed3\u675f\u65e5\u671f',
    timeZone: '\u65f6\u533a',
    timeZoneLocal: '\u672c\u5730\u65f6\u95f4',
    timeZoneUtc: 'UTC',
    search: '\u641c\u7d22\u4f1a\u8bdd',
    searchPlaceholder:
      '\u6309\u4f1a\u8bdd\u3001\u6a21\u578b\u3001\u667a\u80fd\u4f53\u6216\u901a\u9053\u7b5b\u9009',
    query: '\u67e5\u8be2\u7b5b\u9009',
    queryPlaceholder: 'provider:anthropic tool:grep minTokens:1000',
    applyQuery: '\u5e94\u7528\u67e5\u8be2',
    clearQuery: '\u6e05\u7a7a\u67e5\u8be2',
    sort: '\u4f1a\u8bdd\u6392\u5e8f',
    sortRecent: '\u6700\u8fd1\u6d3b\u52a8',
    sortTokens: 'Token \u6700\u591a',
    sortCost: '\u6210\u672c\u6700\u9ad8',
    sortMessages: '\u6d88\u606f\u6700\u591a',
    sortErrors: '\u9519\u8bef\u6700\u591a',
    selectedDays: '\u5df2\u9009\u62e9 {{count}} \u5929',
    selectedSessions: '\u5df2\u9009\u62e9 {{count}} \u4e2a\u4f1a\u8bdd',
    visibleColumns: '\u53ef\u89c1\u5217',
    logRoles: '\u65e5\u5fd7\u89d2\u8272',
    logTools: '\u65e5\u5fd7\u5de5\u5177',
    logHasTools: '\u4ec5\u663e\u793a\u5305\u542b\u5de5\u5177\u7684\u6761\u76ee',
    logQuery: '\u65e5\u5fd7\u641c\u7d22',
    logQueryPlaceholder: '\u6309\u65e5\u5fd7\u5185\u5bb9\u7b5b\u9009',
    clearLogFilters: '\u6e05\u7a7a\u65e5\u5fd7\u7b5b\u9009',
    refresh: '\u5237\u65b0',
    invalidRange:
      '\u7ed3\u675f\u65e5\u671f\u5fc5\u987b\u665a\u4e8e\u6216\u7b49\u4e8e\u5f00\u59cb\u65e5\u671f\u3002',
  },
  summary: {
    updatedAt: '\u66f4\u65b0\u65f6\u95f4',
    compatibility: '\u517c\u5bb9\u6a21\u5f0f',
  },
  compatibility: {
    dateInterpretation: '\u5df2\u542f\u7528\u65e5\u671f\u89e3\u91ca',
    legacyNoDateInterpretation: '\u65e7\u7248\u7f51\u5173\u56de\u9000',
  },
  sections: {
    sessions: '\u4f1a\u8bdd',
    sessionsDescription:
      '\u5728\u6df1\u5165\u5355\u4e2a\u4f1a\u8bdd\u4e4b\u524d\uff0c\u5148\u67e5\u770b\u4f1a\u8bdd\u7ea7\u522b\u7684\u7528\u91cf\u3001\u6210\u672c\u96c6\u4e2d\u5ea6\u548c\u9519\u8bef\u5206\u5e03\u3002',
    dailyBreakdown: '\u6bcf\u65e5\u5206\u89e3',
    dailyBreakdownDescription:
      '\u5bf9\u6bd4\u6bcf\u65e5\u7528\u91cf\u3001\u6210\u672c\u3001\u6d88\u606f\u548c\u9519\u8bef\u6d3b\u52a8\u3002',
    sessionDetail: '\u4f1a\u8bdd\u8be6\u60c5',
    sessionDetailDescription:
      '\u4fdd\u6301\u5f53\u524d\u4f1a\u8bdd\u4e0a\u4e0b\u6587\u3001\u6a21\u578b\u9009\u62e9\u3001\u63d0\u4f9b\u65b9\u548c\u65f6\u5e8f\u8bc1\u636e\u53ef\u89c1\u3002',
    sessionTimeline: '\u4f1a\u8bdd\u65f6\u95f4\u7ebf',
    sessionTimelineDescription:
      '\u67e5\u770b\u6240\u9009\u4f1a\u8bdd\u5728\u65f6\u95f4\u7ebf\u4e0a\u7684 Token \u4e0e\u6210\u672c\u53d8\u5316\u3002',
    sessionLogs: '\u4f1a\u8bdd\u65e5\u5fd7',
    sessionLogsDescription:
      '\u68c0\u67e5 OpenClaw \u7f51\u5173\u8fd4\u56de\u7684\u539f\u59cb\u4f1a\u8bdd\u7528\u91cf\u65e5\u5fd7\u6d41\u3002',
  },
  metrics: {
    totalTokens: '\u603b Token',
    totalCost: '\u603b\u6210\u672c',
    sessionCount: '\u4f1a\u8bdd\u6570',
    errorCount: '\u9519\u8bef\u6570',
  },
  labels: {
    gateway: '\u7f51\u5173',
    version: '\u7248\u672c',
    noVersion: '\u672a\u77e5',
    sessionKey: '\u4f1a\u8bdd',
    sessionId: '\u4f1a\u8bdd ID',
    model: '\u6a21\u578b',
    provider: '\u63d0\u4f9b\u65b9',
    agent: '\u667a\u80fd\u4f53',
    channel: '\u901a\u9053',
    messages: '\u6d88\u606f',
    toolCalls: '\u5de5\u5177\u8c03\u7528',
    errors: '\u9519\u8bef',
    tokens: 'Token',
    cost: '\u6210\u672c',
    inputTokens: '\u8f93\u5165 Token',
    missingCostEntries: '\u7f3a\u5931\u6210\u672c\u6761\u76ee',
    lastActivity: '\u6700\u8fd1\u6d3b\u52a8',
    duration: '\u6301\u7eed\u65f6\u95f4',
    logTime: '\u65f6\u95f4',
    cumulativeTokens: '\u7d2f\u8ba1 Token',
    cumulativeCost: '\u7d2f\u8ba1\u6210\u672c',
    noSessions:
      '\u6ca1\u6709\u4f1a\u8bdd\u5339\u914d\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u3002',
    noDailyBreakdown:
      '\u6240\u9009\u8303\u56f4\u5185\u6ca1\u6709\u53ef\u7528\u7684\u6bcf\u65e5\u7528\u91cf\u6570\u636e\u3002',
    noSessionSelected:
      '\u8bf7\u9009\u62e9\u4e00\u4e2a\u4f1a\u8bdd\u4ee5\u67e5\u770b\u8be6\u60c5\u3001\u65f6\u95f4\u7ebf\u548c\u65e5\u5fd7\u3002',
    refineSessionSelection:
      '\u8bf7\u53ea\u9009\u62e9\u4e00\u4e2a\u4f1a\u8bdd\u4ee5\u67e5\u770b\u8be6\u60c5\u3001\u65f6\u95f4\u7ebf\u548c\u65e5\u5fd7\u3002',
    noTimeline:
      '\u6240\u9009\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u65f6\u95f4\u7ebf\u70b9\u3002',
    noLogs: '\u6240\u9009\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u65e5\u5fd7\u3002',
    noLogTools:
      '\u5f53\u524d\u65e5\u5fd7\u6d41\u4e2d\u672a\u68c0\u6d4b\u5230\u5de5\u5177\u8c03\u7528\u3002',
    noMatchingLogs:
      '\u6ca1\u6709\u65e5\u5fd7\u6761\u76ee\u5339\u914d\u5f53\u524d\u65e5\u5fd7\u7b5b\u9009\u6761\u4ef6\u3002',
  },
};

export default locale;
