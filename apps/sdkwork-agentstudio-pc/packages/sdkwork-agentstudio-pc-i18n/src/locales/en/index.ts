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

const locale = {
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
} as const;

export default locale;
