import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface RouterState {
  pathname: string;
  search: string;
}

interface RouterContextValue {
  pathname: string;
  search: string;
  navigate: (to: string, options?: { replace?: boolean; preserveScroll?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function getBrowserLocation(): RouterState {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  };
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState<RouterState>(getBrowserLocation);

  useEffect(() => {
    const onPopState = () => {
      setLoc(getBrowserLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean; preserveScroll?: boolean }) => {
      const url = new URL(to, window.location.origin);
      const next: RouterState = {
        pathname: url.pathname,
        search: url.search,
      };
      if (options?.replace) {
        window.history.replaceState({}, '', `${next.pathname}${next.search}`);
      } else {
        window.history.pushState({}, '', `${next.pathname}${next.search}`);
      }
      setLoc(next);
      if (!options?.preserveScroll) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    },
    []
  );

  return (
    <RouterContext.Provider value={{ pathname: loc.pathname, search: loc.search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside RouterProvider');
  }
  return ctx;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useRouter();
  return new URLSearchParams(search);
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  preserveScroll?: boolean;
}

export function Link({ to, preserveScroll, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    e.preventDefault();
    navigate(to, { preserveScroll });
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
