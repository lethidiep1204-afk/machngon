import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthRedirectUrl,
  isProtectedRoute,
  isPublicRoute,
  normalizeRoutePath,
  sanitizeRedirectPath,
} from './authGuard';

test('authGuard separates public routes from all protected feature routes', () => {
  assert.equal(isPublicRoute('/'), true);
  assert.equal(isPublicRoute('/auth'), true);
  assert.equal(isPublicRoute('/auth/'), true);
  assert.equal(isProtectedRoute('/'), false);
  assert.equal(isProtectedRoute('/auth'), false);

  const protectedRoutes = [
    '/dashboard',
    '/library',
    '/library/triet-hoc-hien-sinh',
    '/lab',
    '/history',
    '/profile',
    '/guide',
    '/admin',
    '/onboarding',
  ];

  for (const route of protectedRoutes) {
    assert.equal(isProtectedRoute(route), true, `Expected ${route} to be protected`);
    assert.equal(isPublicRoute(route), false, `Expected ${route} not to be public`);
  }
});

test('sanitizeRedirectPath blocks external/open redirects and /auth loops while preserving query strings', () => {
  assert.equal(sanitizeRedirectPath('/library'), '/library');
  assert.equal(sanitizeRedirectPath('/lab?mode=debate&doc=abc'), '/lab?mode=debate&doc=abc');
  assert.equal(sanitizeRedirectPath('/library/doc-1'), '/library/doc-1');

  assert.equal(sanitizeRedirectPath('https://evil.example.com'), '/dashboard');
  assert.equal(sanitizeRedirectPath('//evil.example.com/phish'), '/dashboard');
  assert.equal(sanitizeRedirectPath('/auth?reason=auth_required'), '/dashboard');
  assert.equal(sanitizeRedirectPath(''), '/dashboard');
  assert.equal(sanitizeRedirectPath(null), '/dashboard');
});

test('buildAuthRedirectUrl encodes target path and query string with auth_required reason', () => {
  assert.equal(normalizeRoutePath('/library/'), '/library');
  assert.equal(
    buildAuthRedirectUrl('/library'),
    '/auth?redirect=%2Flibrary&reason=auth_required'
  );
  assert.equal(
    buildAuthRedirectUrl('/lab', '?doc=triet-hoc-1'),
    '/auth?redirect=%2Flab%3Fdoc%3Dtriet-hoc-1&reason=auth_required'
  );
});
