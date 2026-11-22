import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { PaletteQuickModal } from './components/theme/PaletteQuickModal';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { AppProvider, useApp } from './lib/AppContext';
import {
  AUTH_REQUIRED_NOTICE,
  buildAuthRedirectUrl,
  isProtectedRoute,
  normalizeRoutePath,
} from './lib/authGuard';
import { RouterProvider, useRouter } from './lib/router';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { GuidePage } from './pages/GuidePage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LabPage } from './pages/LabPage';
import { LibraryPage } from './pages/LibraryPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';

// Code-split /admin editorial console for leaner initial load
const AdminPage = lazy(() => import('./pages/AdminPage'));

function RouteView() {
  const { pathname, search, navigate } = useRouter();
  const { user } = useApp();
  const { showToast } = useToast();
  const lastRedirectKeyRef = useRef<string | null>(null);

  const normalizedPath = normalizeRoutePath(pathname);
  const blockedByAuth = !user.isAuthenticated && isProtectedRoute(normalizedPath);

  useEffect(() => {
    if (!blockedByAuth) {
      lastRedirectKeyRef.current = null;
      return;
    }

    const redirectKey = `${normalizedPath}${search}`;
    if (lastRedirectKeyRef.current !== redirectKey) {
      lastRedirectKeyRef.current = redirectKey;
      showToast(AUTH_REQUIRED_NOTICE, { variant: 'info' });
    }
    navigate(buildAuthRedirectUrl(normalizedPath, search), { replace: true });
  }, [blockedByAuth, normalizedPath, search, navigate, showToast]);

  let pageNode: React.ReactNode;

  if (blockedByAuth) {
    pageNode = (
      <AuthPage
        forcedReason="auth_required"
        forcedRedirect={`${normalizedPath}${search}`}
      />
    );
  } else if (normalizedPath === '/') {
    pageNode = <HomePage />;
  } else if (normalizedPath === '/auth') {
    pageNode = <AuthPage />;
  } else if (normalizedPath === '/onboarding') {
    pageNode = <OnboardingPage />;
  } else if (normalizedPath === '/dashboard') {
    pageNode = <DashboardPage />;
  } else if (normalizedPath === '/library') {
    pageNode = <LibraryPage />;
  } else if (normalizedPath.startsWith('/library/')) {
    const docId = decodeURIComponent(normalizedPath.slice('/library/'.length));
    pageNode = <DocumentDetailPage documentId={docId} />;
  } else if (normalizedPath === '/lab') {
    pageNode = <LabPage />;
  } else if (normalizedPath === '/guide') {
    pageNode = <GuidePage />;
  } else if (normalizedPath === '/history') {
    pageNode = <HistoryPage />;
  } else if (normalizedPath === '/profile') {
    pageNode = <ProfilePage />;
  } else if (normalizedPath === '/admin') {
    pageNode = (
      <Suspense
        fallback={
          <div className="min-h-dvh flex items-center justify-center bg-[var(--color-bg)] text-sm text-[var(--color-text-muted)]">
            Đang tải trang Quản trị nội dung…
          </div>
        }
      >
        <AdminPage />
      </Suspense>
    );
  } else {
    pageNode = <HomePage />;
  }

  return (
    <motion.div
      key={blockedByAuth ? '/auth' : normalizedPath}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {pageNode}
    </motion.div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <RouterProvider>
            <RouteView />
            <PaletteQuickModal />
          </RouterProvider>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
