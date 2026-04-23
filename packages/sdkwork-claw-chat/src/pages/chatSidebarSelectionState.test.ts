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
