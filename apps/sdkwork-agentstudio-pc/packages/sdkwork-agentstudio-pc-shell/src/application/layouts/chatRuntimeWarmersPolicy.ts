import { ROUTE_PATHS } from '../router/routePaths.ts';

export function shouldRenderChatRuntimeWarmersForPath(pathname: string) {
  return !(
    pathname === ROUTE_PATHS.AUTH ||
    pathname === ROUTE_PATHS.LOGIN ||
    pathname === ROUTE_PATHS.REGISTER ||
    pathname === ROUTE_PATHS.FORGOT_PASSWORD ||
    pathname.startsWith(ROUTE_PATHS.OAUTH_CALLBACK_PREFIX)
  );
}
