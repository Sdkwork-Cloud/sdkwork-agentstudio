import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const sidebarStateSource = readFileSync(
  new URL('./useChatSidebarState.ts', import.meta.url),
  'utf8',
);
const sidebarSource = readFileSync(
  new URL('../components/ChatSidebar.tsx', import.meta.url),
  'utf8',
);
const sidebarChromeSource = readFileSync(
  new URL('../components/ChatSidebarChrome.tsx', import.meta.url),
  'utf8',
);
const sidebarSelectionSource = readFileSync(
  new URL('../services/chatSidebarSelection.ts', import.meta.url),
  'utf8',
);

await runTest(
  'useChatSidebarState standardizes agent and session selection failures into explicit results and visible sidebar error state',
  () => {
    assert.match(
      sidebarStateSource,
      /import \{[\s\S]*CHAT_SIDEBAR_SELECTION_COMPLETED,[\s\S]*createChatSidebarSelectionFailure,[\s\S]*type ChatSidebarSelectionActionResult,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      sidebarStateSource,
      /const \[selectionErrorMessage, setSelectionErrorMessage\] = useState<string \| null>\(null\);/,
    );
    assert.match(
      sidebarStateSource,
      /const beginSelectionRequest = \([\s\S]*setSelectionErrorMessage\(null\);[\s\S]*setSelectionTransition\(\{/s,
    );
    assert.match(
      sidebarStateSource,
      /const handleAgentSelection = async \([\s\S]*selection: ChatSidebarAgentSelection,[\s\S]*\): Promise<ChatSidebarSelectionActionResult> => \{/s,
    );
    assert.match(
      sidebarStateSource,
      /catch \(error: any\) \{[\s\S]*const failure = createChatSidebarSelectionFailure\(\s*error,\s*t\('chat\.sidebar\.selectAgentFailed'\)\s*\);[\s\S]*setSelectionErrorMessage\(failure\.errorMessage\);[\s\S]*return failure;[\s\S]*\}/s,
    );
    assert.match(
      sidebarStateSource,
      /const handleSessionSelection = async \([\s\S]*selection\?: ChatSidebarSessionSelection,[\s\S]*\): Promise<ChatSidebarSelectionActionResult> => \{/s,
    );
    assert.match(
      sidebarStateSource,
      /catch \(error: any\) \{[\s\S]*const failure = createChatSidebarSelectionFailure\(\s*error,\s*t\('chat\.sidebar\.selectSessionFailed'\)\s*\);[\s\S]*setSelectionErrorMessage\(failure\.errorMessage\);[\s\S]*return failure;[\s\S]*\}/s,
    );
    assert.match(
      sidebarStateSource,
      /await commitSelectionPlan\(requestId, plan\);[\s\S]*return CHAT_SIDEBAR_SELECTION_COMPLETED;/s,
    );
    assert.match(
      sidebarStateSource,
      /await setActiveSession\(plan\.nextSessionId, plan\.nextInstanceId\);/,
    );
    assert.doesNotMatch(
      sidebarStateSource,
      /setActiveSession\(plan\.nextSessionId, plan\.nextInstanceId \?\? undefined\)/,
    );
  },
);

await runTest(
  'ChatSidebar and ChatSidebarChrome expose dismissible selection-error feedback and keep mobile close behavior gated on selection success',
  () => {
    assert.match(
      sidebarSource,
      /onSessionSelect\?: \([\s\S]*selection\?: ChatSidebarSessionSelection[\s\S]*\) =>[\s\S]*Promise<ChatSidebarSelectionActionResult \| void>[\s\S]*ChatSidebarSelectionActionResult[\s\S]*void;/s,
    );
    assert.match(
      sidebarSource,
      /onSelectAgent\?: \([\s\S]*selection: ChatSidebarAgentSelection[\s\S]*\) =>[\s\S]*Promise<ChatSidebarSelectionActionResult \| void>[\s\S]*ChatSidebarSelectionActionResult[\s\S]*void;/s,
    );
    assert.match(sidebarSource, /selectionErrorMessage\?: string \| null;/);
    assert.match(sidebarSource, /onDismissSelectionError\?: \(\) => void;/);
    assert.match(
      sidebarSource,
      /selectionErrorMessage \? \([\s\S]*t\('chat\.sidebar\.dismissSelectionError'\)[\s\S]*onDismissSelectionError\?\.\(\)[\s\S]*\) : null/s,
    );
    assert.match(
      sidebarStateSource,
      /selectionErrorMessage,[\s\S]*onDismissSelectionError: \(\) => setSelectionErrorMessage\(null\),/s,
    );
    assert.match(
      sidebarStateSource,
      /async onSelectAgent\(selection\) \{[\s\S]*const result = await handleAgentSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\}/s,
    );
    assert.match(
      sidebarStateSource,
      /async onSessionSelect\(selection\) \{[\s\S]*const result = await handleSessionSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\}/s,
    );
    assert.match(sidebarChromeSource, /selectionErrorMessage\?: string \| null;/);
    assert.match(sidebarChromeSource, /onDismissSelectionError\?: \(\) => void;/);
  },
);

await runTest(
  'ChatSidebar indexes visible history sessions once instead of scanning the session list for every rendered row',
  () => {
    assert.match(
      sidebarSource,
      /const activeHistorySessionById = React\.useMemo\(\(\) => \{/s,
    );
    assert.match(
      sidebarSource,
      /return activeHistorySessionById\.get\(sessionId\) \?\? null;/,
    );
    assert.doesNotMatch(
      sidebarSource,
      /const resolveSessionRecord = \(sessionId: string\) =>\s*activeHistorySessions\.find\(\(session\) => session\.id === sessionId\) \?\? null;/,
    );
    assert.doesNotMatch(
      sidebarSource,
      /activeHistorySessions\.find\(\(session\) => session\.id === item\.sessionId\)/,
    );
  },
);

await runTest(
  'useChatSidebarState keeps current-instance agent switching on the fast path before falling back to cross-instance discovery',
  () => {
    assert.match(
      sidebarStateSource,
      /resolveChatSidebarKnownAgentLinkedInstanceId,/,
    );
    assert.match(
      sidebarStateSource,
      /const knownLinkedInstanceId = resolveChatSidebarKnownAgentLinkedInstanceId\(\{\s*agentId: selection\.agentId,\s*currentActiveInstanceId,\s*agentOptions: presentation\.sidebarAgentOptions,\s*\}\);/s,
    );
    assert.match(
      sidebarStateSource,
      /const linkedInstanceId =\s*knownLinkedInstanceId !== undefined\s*\? knownLinkedInstanceId\s*: await resolveChatAgentLinkedInstanceId\(\{[\s\S]*agentId: selection\.agentId,[\s\S]*preferredInstanceId: currentActiveInstanceId,[\s\S]*\}\)\.catch\(\(\) => null\);/s,
    );
    assert.doesNotMatch(
      sidebarStateSource,
      /const linkedInstanceId = await resolveChatAgentLinkedInstanceId\(\{[\s\S]*agentId: selection\.agentId,[\s\S]*preferredInstanceId: currentActiveInstanceId,[\s\S]*\}\)\.catch\(\(\) => null\);/s,
    );
  },
);

await runTest(
  'chat sidebar agent selection plans do not block current-instance agent switches on redundant hydration',
  () => {
    assert.match(
      sidebarSelectionSource,
      /export function resolveChatSidebarKnownAgentLinkedInstanceId\(/,
    );
    assert.match(
      sidebarSelectionSource,
      /shouldHydrateTargetInstance:\s*Boolean\(nextInstanceId\) &&\s*nextInstanceId !== params\.currentActiveInstanceId,/s,
    );
    assert.doesNotMatch(
      sidebarSelectionSource,
      /nextInstanceId !== params\.currentActiveInstanceId \|\|\s*params\.selection\.agentId !== null/s,
    );
  },
);
