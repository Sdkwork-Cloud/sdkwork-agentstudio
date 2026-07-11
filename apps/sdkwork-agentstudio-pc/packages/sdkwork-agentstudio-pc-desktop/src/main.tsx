import './desktop/styles/main.css';
import { reportDesktopStartupFatalError } from './desktop/bootstrap/desktopStartupFatalErrorReporter';

function installDesktopStartupFatalErrorListeners() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleError = (event: ErrorEvent) => {
    void reportDesktopStartupFatalError(event.error ?? event.message);
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    void reportDesktopStartupFatalError(event.reason);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}

async function bootstrapDesktopApp() {
  const disposeFatalErrorListeners = installDesktopStartupFatalErrorListeners();
  try {
    const { createDesktopApp } = await import('./desktop/bootstrap/createDesktopApp');
    await createDesktopApp();
    window.setTimeout(() => {
      disposeFatalErrorListeners();
    }, 20000);
  } catch (error) {
    await reportDesktopStartupFatalError(error);
    disposeFatalErrorListeners();
    throw error;
  }
}

void bootstrapDesktopApp();
