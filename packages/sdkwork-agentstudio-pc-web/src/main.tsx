import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapShellRuntime } from '@sdkwork/agentstudio-pc-shell';
import App from './App';

const STARTUP_FATAL_TITLE = 'Agent Studio failed to start';

function summarizeStartupError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (typeof error === 'undefined' || error === null) {
    return 'Unknown startup error.';
  }

  return String(error);
}

function resolveWebRootElement(): HTMLElement {
  const root = document.getElementById('root');
  if (root instanceof HTMLElement) {
    return root;
  }

  if (!document.body) {
    throw new Error('Agent Studio root element is missing and document.body is unavailable.');
  }

  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
  return fallbackRoot;
}

function reportWebStartupFatalError(error: unknown) {
  console.error(STARTUP_FATAL_TITLE, error);

  if (typeof document === 'undefined') {
    return;
  }

  const root = resolveWebRootElement();
  root.replaceChildren();
  root.dataset.startupStatus = 'failed';
  root.style.minHeight = '100vh';
  root.style.background = '#09090b';
  root.style.color = '#fafafa';
  root.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const panel = document.createElement('main');
  panel.style.boxSizing = 'border-box';
  panel.style.display = 'flex';
  panel.style.minHeight = '100vh';
  panel.style.flexDirection = 'column';
  panel.style.justifyContent = 'center';
  panel.style.padding = '32px';
  panel.style.margin = '0 auto';
  panel.style.maxWidth = '720px';

  const title = document.createElement('h1');
  title.textContent = STARTUP_FATAL_TITLE;
  title.style.margin = '0 0 12px';
  title.style.fontSize = '24px';
  title.style.fontWeight = '650';

  const message = document.createElement('p');
  message.textContent = summarizeStartupError(error);
  message.style.margin = '0';
  message.style.color = '#d4d4d8';
  message.style.fontSize = '14px';
  message.style.lineHeight = '1.7';

  panel.append(title, message);
  root.append(panel);
}

function installWebStartupFatalErrorListeners() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleError = (event: ErrorEvent) => {
    reportWebStartupFatalError(event.error ?? event.message);
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportWebStartupFatalError(event.reason);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}

async function mountApp() {
  const disposeFatalErrorListeners = installWebStartupFatalErrorListeners();
  try {
    await bootstrapShellRuntime();

    createRoot(resolveWebRootElement()).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    window.setTimeout(() => {
      disposeFatalErrorListeners();
    }, 20000);
  } catch (error) {
    disposeFatalErrorListeners();
    throw error;
  }
}

void mountApp().catch(reportWebStartupFatalError);
