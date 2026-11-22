import React from 'react';
import { EmptyArchiveSvg } from '../visuals/EditorialSvgIllustrations';

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
}

export function PageHeader({
  kicker,
  title,
  description,
  action,
  leading,
}: PageHeaderProps) {
  return (
    <header className="pb-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        {leading && <div className="shrink-0 mt-0.5">{leading}</div>}
        <div className="min-w-0">
          {kicker && <p className="editorial-kicker">{kicker}</p>}
          <h1 className="mt-1 font-display text-3xl sm:text-[2.125rem] font-semibold leading-tight tracking-tight text-[var(--color-text)]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

interface SectionHeadingProps {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeading({ id, title, description, action }: SectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          id={id}
          className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-text)]"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface EmptyStateCardProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyStateCard({
  title,
  description,
  action,
  compact = false,
}: EmptyStateCardProps) {
  return (
    <div
      className={`rounded-2xl surface-card flex flex-col items-center text-center ${
        compact ? 'p-7' : 'p-10 sm:p-12'
      }`}
    >
      <EmptyArchiveSvg className={compact ? 'w-36 h-24' : 'w-44 h-32'} />
      <h2 className="mt-4 font-display text-xl font-semibold text-[var(--color-text)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
