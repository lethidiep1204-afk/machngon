import React, { lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { PaletteQuickModal } from './components/theme/PaletteQuickModal';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { ToastProvider } from './components/ui/ToastProvider';
import { AppProvider } from './lib/AppContext';
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
  const { pathname } = useRouter();
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  let pageNode: React.ReactNode;

  if (normalizedPath === '/') {
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
      key={normalizedPath}
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
