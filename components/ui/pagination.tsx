import * as React from 'react';
import { cn } from '@/lib/utils';

export function Pagination({
  className,
  ...props
}: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="paginação"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

export function PaginationItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return <li className={cn('', className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  size?: 'default' | 'icon';
  disabled?: boolean;
} & React.ComponentProps<'button'>;

export function PaginationLink({
  className,
  isActive,
  size = 'default',
  disabled,
  ...props
}: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-40',
        size === 'icon' ? 'h-8 w-8' : 'h-8 min-w-8 px-3',
        isActive
          ? 'bg-gold text-black hover:brightness-105'
          : 'text-zinc-200 hover:bg-surface-muted',
        className,
      )}
      {...props}
    />
  );
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cn('flex h-8 w-8 items-center justify-center text-zinc-400', className)}
      {...props}
    >
      …
      <span className="sr-only">Mais páginas</span>
    </span>
  );
}
