import assert from 'node:assert/strict';

import { resolveRedirectTarget } from './authRouteUtils.ts';

assert.equal(resolveRedirectTarget(null), '/dashboard');
assert.equal(resolveRedirectTarget(''), '/dashboard');
assert.equal(resolveRedirectTarget('https://example.com'), '/dashboard');
assert.equal(resolveRedirectTarget('/chat'), '/chat');
assert.equal(resolveRedirectTarget('/settings?tab=api'), '/settings?tab=api');

for (const target of [
  '/auth?redirect=/chat',
  '/auth#login',
  '/login?account=user@example.com',
  '/login#password',
  '/register?redirect=/chat',
  '/register#email',
  '/forgot-password?account=user@example.com',
  '/forgot-password#reset',
  '/login/oauth/callback/github?code=abc',
]) {
  assert.equal(
    resolveRedirectTarget(target),
    '/dashboard',
    `auth redirect target ${target} should fall back to dashboard`,
  );
}

console.log('ok - auth route redirects reject auth surfaces with query or hash fragments');
